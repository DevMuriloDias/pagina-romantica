import Link from "next/link";
import { HeroDemo } from "@/components/site/HeroDemo";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { activeTemplates, cheapestPriceCents } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { fontStack, googleFontsUrl } from "@/lib/theme/fonts";
import { gradientCss } from "@/lib/theme/css";

export const revalidate = 300;

const STEPS = [
  { n: "01", title: "Conte a história de vocês", text: "Responda perguntinhas rápidas: como se conheceram, lembranças, apelidos. Pode pular o que quiser.", hand: "leva 3 minutos" },
  { n: "02", title: "A IA escreve o primeiro rascunho", text: "Cartas, motivos, linha do tempo e quiz prontos. Depois você edita tudo com prévia ao vivo.", hand: "e você deixa com a sua cara" },
  { n: "03", title: "Entregue a surpresa", text: "Receba o link e o QR Code na hora, por e-mail também. Mande no WhatsApp ou imprima num cartão.", hand: "e espere a reação 🥹" },
];

const FEATURES = [
  ["💌", "Cartinhas em envelopes", "Inclusive “abra quando...” e cartas que só abrem numa data."],
  ["🎵", "A música de vocês", "YouTube ou Spotify, tocando assim que a página abre."],
  ["🔐", "Tela de entrada secreta", "Uma senha ou pergunta que só seu amor sabe responder."],
  ["📸", "Fotos do jeito certo", "Polaroids, carrossel, filme fotográfico ou livro de memórias."],
  ["🗺️", "Mapa dos lugares", "Pins de coração onde a história de vocês aconteceu."],
  ["✨", "Céu da data especial", "As estrelas exatamente como estavam naquela noite."],
  ["💍", "Pedido especial", "Botões Sim e Não — e o “Não” foge do dedo."],
  ["⏳", "Contador ao vivo", "Anos, meses, dias... e segundos de vocês dois."],
];

const TESTIMONIALS = [
  { name: "Carla, 29", text: "Fiz no intervalo do almoço e meu namorado chorou no aniversário. A parte da senha com a data foi tudo!" },
  { name: "Rafael, 34", text: "Usei pro pedido de casamento. O botão de “não” fugindo arrancou risada antes do sim 💍" },
  { name: "Bia, 22", text: "Coloquei nossa música e as fotos da viagem. Ela abriu no ônibus e me ligou na hora kkkk" },
];

export default async function HomePage() {
  const [templates, cheapest] = await Promise.all([activeTemplates(), cheapestPriceCents()]);
  const faq = [
    ["Preciso criar conta ou senha?", "Não. Você cria a página sem cadastro — tudo é salvo automaticamente neste navegador. Só pedimos seu e-mail no pagamento, para enviar o link da página e o seu link de edição."],
    ["Quanto custa?", cheapest !== null ? `É pagamento único, a partir de ${formatBRL(cheapest)}. Você só vê o valor final no fim, depois de montar e revisar tudo.` : "É pagamento único. Você vê o valor no final, depois de montar e revisar tudo."],
    ["Como meu amor recebe a página?", "Assim que o pagamento é aprovado, o link aparece na sua tela e chega no seu e-mail, junto com um QR Code para imprimir. Você manda como quiser: WhatsApp, cartão, presente..."],
    ["Posso editar depois de pagar?", "Pode! O e-mail de confirmação traz um link mágico de edição. E em “Minhas páginas” você acessa tudo só com o seu e-mail."],
    ["Quais formas de pagamento?", "Pix (aprovação na hora) e cartão de crédito, com parcelamento. O pagamento é processado pelo Mercado Pago — seus dados de cartão nunca passam pelos nossos servidores."],
    ["A música toca sozinha?", "Com YouTube, sim: ela começa assim que a pessoa toca no botão de abrir. O Spotify não permite tocar sozinho e, para quem não tem conta, toca só 30 segundos — por isso recomendamos o YouTube."],
    ["Outras pessoas podem achar a página?", "Não. O endereço tem um código aleatório, a página não aparece no Google e você ainda pode protegê-la com senha ou pergunta secreta."],
  ];

  const galleryFonts = googleFontsUrl(templates.flatMap((t) => [t.theme.fonts.heading, t.theme.fonts.script]));
  return (
    <>
      {galleryFonts ? <link rel="stylesheet" href={galleryFonts} precedence="default" /> : null}
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* HERO */}
        <section className="paper-grain relative">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1 text-xs font-medium text-ink-soft">
                <span className="size-1.5 rounded-full bg-rose" /> Pronta em minutos · com ajuda de IA · sem cadastro
              </p>
              <h1 className="font-display text-[2.6rem] leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl" style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}>
                Diga tudo o que sente.
                <br />
                <span className="italic text-rose">Numa página</span> só de vocês.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
                Cartinhas que abrem como envelopes, a música de vocês tocando, fotos, a linha do tempo, o céu da noite em que tudo começou — num link para entregar a quem você ama.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="xl">
                  <Link href="/criar">Criar minha página 💌</Link>
                </Button>
                <span className="font-hand text-2xl text-ink-soft">↖ comece de graça, pague só no final</span>
              </div>
            </div>
            <HeroDemo />
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-y border-line bg-white/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Como funciona</h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="relative">
                  <span className="font-display text-7xl italic text-blush">{s.n}</span>
                  <h3 className="-mt-6 font-display text-2xl">{s.title}</h3>
                  <p className="mt-3 text-ink-soft">{s.text}</p>
                  <p className="mt-2 font-hand text-2xl text-rose">{s.hand}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Muito mais que um cartão</h2>
            <p className="mt-4 text-lg text-ink-soft">Ligue e desligue o que quiser, arraste para mudar a ordem e personalize cada detalhe.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([emoji, title, text]) => (
              <div key={title} className="group rounded-2xl border border-line bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(42,20,24,0.4)]">
                <span className="text-3xl transition-transform group-hover:scale-110 inline-block">{emoji}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* MODELOS */}
        <section id="modelos" className="bg-ink py-20 text-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              {templates.length} estilos para <span className="italic text-blush">começar</span>
            </h2>
            <p className="mt-4 max-w-xl text-paper/70">Troque de estilo quando quiser — o conteúdo nunca se perde. Cores, fontes e fundo são 100% editáveis.</p>
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
              {templates.map((t) => {
                const bg = t.theme.background.type === "gradient" ? gradientCss(t.theme.background.gradient.colors, t.theme.background.gradient.angle) : t.theme.colors.background;
                return (
                  <Link href={`/criar?modelo=${t.id}`} key={t.id} className="group overflow-hidden rounded-2xl bg-paper/5 ring-1 ring-paper/10 transition hover:ring-paper/40">
                    <div className="flex aspect-[4/5] flex-col items-center justify-center p-4 text-center" style={{ background: bg, color: t.theme.colors.text }}>
                      <span className="text-sm" style={{ fontFamily: fontStack(t.theme.fonts.script), color: t.theme.colors.primary }}>
                        Para você
                      </span>
                      <span className="mt-1 text-2xl font-semibold leading-tight" style={{ fontFamily: fontStack(t.theme.fonts.heading) }}>
                        Nosso amor
                      </span>
                      <div className="mt-4 flex gap-1.5">
                        {[t.theme.colors.primary, t.theme.colors.secondary, t.theme.colors.accent].map((c) => (
                          <span key={c} className="size-4 rounded-full ring-2 ring-white/60" style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="line-clamp-1 text-xs text-paper/60">{t.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* DEPOIMENTOS */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Quem já surpreendeu</h2>
          <p className="mt-2 text-xs uppercase tracking-widest text-ink-soft/70">Depoimentos ilustrativos — exemplo para o lançamento</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <figure key={t.name} className="rounded-2xl border border-line bg-white p-6" style={{ rotate: `${(i - 1) * 1.2}deg` }}>
                <blockquote className="font-display text-lg leading-snug">“{t.text}”</blockquote>
                <figcaption className="mt-4 font-hand text-xl text-rose">— {t.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line bg-white/60">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Perguntas frequentes</h2>
            <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-white">
              {faq.map(([q, a]) => (
                <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {q}
                    <span className="text-rose transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative overflow-hidden bg-rose py-20 text-center text-white">
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px)", backgroundSize: "40px 40px, 60px 60px" }} aria-hidden />
          <div className="relative mx-auto max-w-2xl px-4">
            <h2 className="font-display text-4xl tracking-tight sm:text-6xl">Tem alguém esperando por isso.</h2>
            <p className="mt-4 font-hand text-3xl text-white/90">e vai ser inesquecível</p>
            <Button asChild size="xl" variant="dark" className="mt-8">
              <Link href="/criar">Criar minha página agora</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
