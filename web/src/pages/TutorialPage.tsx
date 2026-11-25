import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Puzzle, ClipboardPaste, RefreshCcw, CheckCircle2 } from "lucide-react";

const STEPS: { icon: typeof Puzzle; title: string; body: React.ReactNode }[] = [
  {
    icon: Puzzle,
    title: "1. Install ekstensi Cookie-Editor",
    body: (
      <>
        <p>
          Buka Chrome Web Store, cari <strong>"Cookie-Editor"</strong>, lalu klik <strong>Add to Chrome</strong>. Bisa juga
          lewat link resminya di{" "}
          <a href="https://cookie-editor.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline underline-offset-2">
            cookie-editor.com <ExternalLink className="size-3" />
          </a>
          .
        </p>
        <p className="mt-2 text-muted-foreground">
          Setelah terpasang, ikon Cookie-Editor (gambar kue) akan muncul di pojok kanan atas Chrome, di sebelah address bar.
          Kalau tidak terlihat, klik ikon puzzle (ekstensi) lalu pin Cookie-Editor supaya selalu tampil.
        </p>
      </>
    ),
  },
  {
    icon: Download,
    title: "2. Ambil & unduh cookie dari Cookie Scraping Tools",
    body: (
      <>
        <p>
          Di dashboard Cookie Scraping Tools, buka akun yang diinginkan → cari app tujuan (mis. Netflix, ChatGPT) → pilih
          item/slot akun → klik <Badge variant="success">Get</Badge>.
        </p>
        <p className="mt-2 text-muted-foreground">
          Setelah berhasil, klik ikon download di sebelah tombol Get. File <code>&lt;itemId&gt;-cookies.json</code> akan
          terunduh ke folder Downloads. File inilah yang akan di-import ke Cookie-Editor.
        </p>
      </>
    ),
  },
  {
    icon: ExternalLink,
    title: "3. Buka website tujuan dulu (penting!)",
    body: (
      <p>
        Sebelum import, <strong>buka dulu website yang sesuai</strong> dengan cookie yang diambil (mis. kalau cookie-nya
        Netflix, buka <code>netflix.com</code> di tab aktif). Cookie-Editor selalu bekerja pada <em>domain tab yang
        sedang aktif</em> — kalau Anda sedang di tab lain, cookie akan ter-import ke domain yang salah dan tidak akan
        berfungsi.
      </p>
    ),
  },
  {
    icon: ClipboardPaste,
    title: "4. Buka Cookie-Editor, lalu Import",
    body: (
      <>
        <p>Di tab website tujuan tadi, klik ikon Cookie-Editor di toolbar Chrome. Akan terbuka panel kecil berisi daftar cookie domain tersebut (mungkin kosong/beda kalau belum login).</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Klik tombol <strong>Import</strong> (ikon panah masuk, biasanya di baris tombol bawah panel).
          </li>
          <li>
            Ada dua cara: <strong>pilih file</strong> hasil unduhan tadi (<code>*-cookies.json</code>), atau{" "}
            <strong>paste</strong> langsung isi JSON-nya ke kotak teks yang muncul.
          </li>
          <li>
            Kalau pilih paste: buka file <code>*-cookies.json</code> yang terunduh pakai text editor / Notepad, salin
            (Ctrl+A, Ctrl+C) seluruh isinya, lalu paste (Ctrl+V) ke kotak import Cookie-Editor.
          </li>
          <li>
            Klik <strong>Import</strong> / tombol centang untuk konfirmasi.
          </li>
        </ol>
      </>
    ),
  },
  {
    icon: RefreshCcw,
    title: "5. Refresh halaman",
    body: (
      <p>
        Setelah import berhasil, <strong>reload halaman</strong> (tekan F5 atau Ctrl+R). Cookie yang baru di-import baru
        akan terpakai setelah halaman dimuat ulang.
      </p>
    ),
  },
  {
    icon: CheckCircle2,
    title: "6. Selesai -- cek hasilnya",
    body: (
      <p>
        Kalau cookie valid dan belum kadaluarsa, halaman akan menunjukkan Anda sudah login (mis. masuk ke halaman
        "Browse" Netflix, bukan halaman login). Kalau masih diminta login, cek lagi: domain tab harus persis sama
        dengan domain cookie, dan coba klik <strong>Get</strong> ulang di Cookie Scraping Tools untuk mengambil cookie yang lebih
        baru.
      </p>
    ),
  },
];

export function TutorialPage() {
  return (
    <div className="min-h-full bg-background">
      <header className="hidden border-b border-border bg-card/70 px-6 py-4 backdrop-blur lg:block">
        <h1 className="font-mono text-lg font-semibold text-brand">Tutorial</h1>
        <p className="text-sm text-muted-foreground">Dari install ekstensi sampai cookie berhasil terpakai di website.</p>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <Card className="shadow-panel lg:hidden">
          <CardHeader>
            <CardTitle>Tutorial</CardTitle>
            <CardDescription>Dari install ekstensi sampai cookie berhasil terpakai di website.</CardDescription>
          </CardHeader>
        </Card>

        {STEPS.map((step) => (
          <Card key={step.title} className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <step.icon className="size-4 text-brand" />
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">{step.body}</CardContent>
          </Card>
        ))}

        <Card className="border-highlight/30 bg-accent shadow-panel">
          <CardContent className="flex flex-col gap-2 pt-6 text-sm">
            <p className="font-medium text-accent-foreground">Tips kalau gagal:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Pastikan tab aktif persis di domain yang sama dengan cookie (termasuk subdomain www vs tanpa www).</li>
              <li>Beberapa app punya batas pengambilan harian (lihat catatan di halaman app masing-masing) -- kalau "Get" gagal karena limit, tunggu & coba lagi nanti.</li>
              <li>Cookie yang sudah lama (lihat kolom "diambil") bisa saja sudah kadaluarsa -- klik "Get" lagi untuk ambil yang baru sebelum import ulang.</li>
              <li>
                Gunakan tombol <Badge variant="secondary">Export cookie.json</Badge> di Dashboard untuk mengekspor sesi
                akun itu sendiri, berbeda dengan cookie per-app yang diambil lewat "Get".
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="pb-4">
          <Button variant="outline" asChild>
            <a href="https://cookie-editor.com/" target="_blank" rel="noreferrer">
              Buka cookie-editor.com <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
