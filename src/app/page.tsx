import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-10 text-center">
        <Image
          src="/logoBizarro.png"
          alt="Bizarro"
          width={120}
          height={120}
          priority
        />

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-white font-black text-7xl sm:text-9xl uppercase tracking-tighter leading-none">
            BIZARRO
          </h1>
          <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">
            Tu tracker de WODs
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Link
            href="/login"
            className="flex-1 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl px-6 py-4 hover:bg-neutral-200 active:scale-95 transition-all text-center"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="flex-1 border border-neutral-800 text-neutral-400 font-mono uppercase tracking-widest text-xs rounded-xl px-6 py-4 hover:border-neutral-600 hover:text-white transition-all text-center"
          >
            Registrarse
          </Link>
        </div>
      </div>
    </main>
  )
}
