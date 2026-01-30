export default function Footer(): JSX.Element {
  return (
    <footer className="border-t border-brand/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 text-sm text-brand/70 sm:px-6">
        <p>© {new Date().getFullYear()} Choisir sa ville</p>
        <div className="flex gap-4">
          <a className="hover:text-brand-dark" href="/docs">Docs</a>
          <a className="hover:text-brand-dark" href="/specs">Specs</a>
        </div>
      </div>
    </footer>
  );
}
