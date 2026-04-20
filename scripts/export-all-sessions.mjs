import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const PAGE_SIZE = 1000
const OUTPUT_SHEET_NAME = "Semua Sesi"

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName)
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }

    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) {
      continue
    }

    const rawValue = line.slice(separatorIndex + 1).trim()
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "")
    process.env[key] = normalizedValue
  }
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variabel lingkungan ${name} wajib diisi untuk menjalankan ekspor semua sesi.`)
  }

  return value
}

function getSupabaseAdminConfig() {
  loadEnvFile(".env")

  const supabaseUrl = getRequiredEnv("SUPABASE_URL")
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")

  try {
    new URL(supabaseUrl)
  } catch {
    throw new Error("SUPABASE_URL tidak valid.")
  }

  return { supabaseUrl, serviceRoleKey }
}

async function fetchAllSessions(client) {
  const allRows = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("feed_sessions")
      .select("*")
      .order("timestamp", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Gagal mengambil data dari tabel feed_sessions: ${error.message}`)
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < PAGE_SIZE) {
      break
    }
  }

  return allRows
}

function buildWorksheet(rows) {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([["Belum ada data sesi yang tersimpan."]])
  }

  return XLSX.utils.json_to_sheet(rows)
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig()
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const rows = await fetchAllSessions(supabase)
  const worksheet = buildWorksheet(rows)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, OUTPUT_SHEET_NAME)

  const datePart = new Date().toISOString().split("T")[0]
  const fileName = `Laporan_Semua_Sesi_${datePart}.xlsx`
  const outputPath = path.join(process.cwd(), fileName)

  XLSX.writeFile(workbook, outputPath)

  console.log(`Laporan semua sesi berhasil dibuat: ${outputPath}`)
  console.log(`Jumlah sesi yang diekspor: ${rows.length}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui."
  console.error(message)
  process.exitCode = 1
})
