import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Puzzle, ClipboardPaste, RefreshCcw, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const STEPS: { icon: typeof Puzzle; title: string; body: React.ReactNode }[] = [
  {
    icon: Puzzle,
    title: "1. Install the Cookie-Editor extension",
    body: (
      <>
        <p>
          Open the Chrome Web Store, search for <strong>"Cookie-Editor"</strong>, then click <strong>Add to Chrome</strong>.
          You can also use the official link at{" "}
          <a href="https://cookie-editor.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline underline-offset-2">
            cookie-editor.com <ExternalLink className="size-3" />
          </a>
          .
        </p>
        <p className="mt-2 text-muted-foreground">
          Once installed, the Cookie-Editor icon (a cookie) appears at the top right of Chrome, next to the address bar.
          If you can't see it, click the puzzle (extensions) icon and pin Cookie-Editor so it stays visible.
        </p>
      </>
    ),
  },
  {
    icon: Download,
    title: "2. Fetch and download cookies from Cookie Scraping Tools",
    body: (
      <>
        <p>
          In the Cookie Scraping Tools dashboard, open the account you want → find the target app (e.g. Netflix, ChatGPT) →
          pick an item/account slot → click <Badge variant="success">Get</Badge>.
        </p>
        <p className="mt-2 text-muted-foreground">
          When it succeeds, click the download icon next to the Get button. A <code>&lt;itemId&gt;-cookies.json</code> file
          is saved to your Downloads folder. This is the file you import into Cookie-Editor.
        </p>
      </>
    ),
  },
  {
    icon: ExternalLink,
    title: "3. Open the target website first (important!)",
    body: (
      <p>
        Before importing, <strong>open the website that matches</strong> the cookies you fetched (e.g. for Netflix cookies,
        open <code>netflix.com</code> in the active tab). Cookie-Editor always works on <em>the domain of the active
        tab</em> — if you are on another tab, the cookies are imported into the wrong domain and won't work.
      </p>
    ),
  },
  {
    icon: ClipboardPaste,
    title: "4. Open Cookie-Editor and import",
    body: (
      <>
        <p>On the target website's tab, click the Cookie-Editor icon in the Chrome toolbar. A small panel lists that domain's cookies (it may be empty or different if you are not signed in).</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Click the <strong>Import</strong> button (the inward arrow, usually in the bottom button row of the panel).
          </li>
          <li>
            There are two ways: <strong>choose the file</strong> you downloaded (<code>*-cookies.json</code>), or{" "}
            <strong>paste</strong> its JSON content into the text box that appears.
          </li>
          <li>
            To paste: open the downloaded <code>*-cookies.json</code> file in a text editor / Notepad, copy everything
            (Ctrl+A, Ctrl+C), then paste (Ctrl+V) into Cookie-Editor's import box.
          </li>
          <li>
            Click <strong>Import</strong> / the check button to confirm.
          </li>
        </ol>
      </>
    ),
  },
  {
    icon: RefreshCcw,
    title: "5. Reload the page",
    body: (
      <p>
        After a successful import, <strong>reload the page</strong> (F5 or Ctrl+R). Imported cookies only take effect once
        the page is loaded again.
      </p>
    ),
  },
  {
    icon: CheckCircle2,
    title: "6. Done -- check the result",
    body: (
      <p>
        If the cookies are valid and not expired, the page shows you as signed in (e.g. Netflix's "Browse" page instead
        of the login page). If it still asks you to sign in, check that the tab's domain matches the cookie domain exactly,
        and click <strong>Get</strong> again in Cookie Scraping Tools to fetch newer cookies.
      </p>
    ),
  },
];

export function TutorialPage() {
  return (
    <div className="min-h-full bg-background">
      <PageHeader title="Tutorial" subtitle="From installing the extension to using the cookies on a website." />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        {STEPS.map((step) => (
          <Card key={step.title} className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <step.icon className="size-4 shrink-0 text-brand" />
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">{step.body}</CardContent>
          </Card>
        ))}

        <Card className="border-highlight/30 bg-accent shadow-panel">
          <CardContent className="flex flex-col gap-2 pt-6 text-sm">
            <p className="font-medium text-accent-foreground">If it fails:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Make sure the active tab is on exactly the same domain as the cookies (including www vs. no www).</li>
              <li>Some apps have a daily fetch limit (see the note on each app's page) -- if "Get" fails because of the limit, wait and try again later.</li>
              <li>Old cookies (check when they were fetched) may have expired -- click "Get" again before re-importing.</li>
              <li>
                Admins can use <Badge variant="secondary">Export cookie.json</Badge> on the Dashboard to export the account's
                own session, which is different from the per-app cookies fetched with "Get".
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="pb-4">
          <Button variant="outline" asChild>
            <a href="https://cookie-editor.com/" target="_blank" rel="noreferrer">
              Open cookie-editor.com <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
