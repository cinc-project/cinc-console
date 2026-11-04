import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "./login-form";

const LICENSE_URL =
  "https://github.com/cinc-project/cinc-console/blob/main/LICENSE";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 rounded-2xl bg-white px-6 py-5 shadow-lg shadow-black/30">
              <Image
                src="/cinc/logo.png"
                alt="Cinc"
                width={84}
                height={94}
                priority
                unoptimized
              />
            </div>
            <h1 className="text-lg font-medium tracking-tight text-text">console</h1>
            <p className="mt-1 text-sm text-muted">Sign in to your Cinc Server</p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        <p>
          © 2026 Tim Smith. Licensed under the{" "}
          <a href={LICENSE_URL} className="text-link underline underline-offset-2 hover:text-text">
            Business Source License 1.1
          </a>
          .
        </p>
        <p className="mt-1">
          Cinc Is Not Chef ·{" "}
          <a href="https://cinc.sh/" className="text-link underline underline-offset-2 hover:text-text">
            cinc.sh
          </a>
        </p>
      </footer>
    </div>
  );
}
