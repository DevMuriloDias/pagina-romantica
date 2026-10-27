# Decisões de implementação

Decisões que não estavam no documento original. Regra seguida: a opção mais simples e robusta.

## Plataforma
- **Next.js 15.5 + React 19 + Tailwind 4.** Componentes no padrão shadcn/ui escritos à mão sobre Radix (sem CLI), para não depender de rede no build.
- **Zod 3** (estável com todo o ecossistema usado). **Prisma 6** (o 7 exige driver adapters e `prisma.config.ts`).
- **Mercado Pago via REST (`fetch`) em vez do SDK Node**: poucos endpoints (`/v1/payments`, `/refunds`), respostas validadas com Zod, fácil de simular em testes.
- **Provedor de pagamentos simulado (`PAYMENTS_PROVIDER=mock`)**: o Pix do sandbox do MP não pode ser pago automaticamente, então o E2E e o desenvolvimento usam um simulador que dispara o **mesmo** webhook com `x-signature` válida. A lógica de liberação é a mesma de produção.
- **Storage local (`STORAGE_DRIVER=local`)** para dev/testes, simulando a URL pré-assinada com assinatura HMAC.

## Conteúdo e editor
- Conteúdo e tema em JSON separados (`Page.content` versionado com `schemaVersion`; `Page.theme` com design tokens). Overrides de estilo ficam em cada seção (`section.style`), por isso trocar de template nunca apaga conteúdo nem os ajustes por seção.
- **Música, efeitos de fundo, tela de entrada e QR Code são globais** (não seções): fazem sentido uma vez por página.
- “Capa” (hero) é uma seção obrigatória (pode ser ocultada, não removida). Limite de instâncias por módulo no registro.
- **Preview fiel**: mesmo componente; container queries (`@md:`) no lugar de breakpoints de viewport; elementos `fixed` presos à moldura via `transform` no container (modo `contained`).
- Histórico de desfazer/refazer agrupa digitação no mesmo campo em um passo (900 ms).
- Autosave com debounce de 1,2 s + `keepalive` ao sair/ocultar a aba.
- **Recorte de foto**: proporção + zoom + arrastar, gerando uma nova imagem (não-destrutivo). Requer CORS no bucket (documentado).
- **Paleta a partir da foto** usa `node-vibrant` no navegador, só com fotos já enviadas.
- Páginas **pagas continuam editáveis**; as mudanças vão ao ar no próximo autosave. O conteúdo é validado contra os limites do plano pago (erro amigável se exceder). Upgrade de plano após pagar ficou fora do escopo.
- Preços **não aparecem no editor** (apenas o selo “Premium”); a rota de planos do editor não envia valores.

## Acesso e segurança
- Rascunho: token aleatório (256 bits) em cookie `httpOnly` por página (`aep_p_<id>`), hash SHA-256 no banco.
- Link “continuar depois”: concessão assinada (HMAC) gravada no cookie, sem expor nem rotacionar o token original (o navegador antigo continua funcionando).
- Link mágico de edição: token aleatório com hash no banco e expiração **deslizante de 90 dias** (renovada a cada uso). Reenviar o e-mail pelo admin gera um novo token (o anterior deixa de valer).
- “Minhas páginas”: magic link assinado (30 min) → sessão assinada em cookie (30 dias). A resposta do pedido de link é sempre igual (não revela se o e-mail existe).
- Tela de entrada: respostas normalizadas (minúsculas, sem acentos, **sem pontuação**, espaços colapsados — assim `12/06/2021` = `12062021`) e guardadas com **bcrypt**. Quando a página é protegida, **o HTML inicial não contém o conteúdo**: ele só é entregue pela API após a resposta correta (cookie de desbloqueio assinado por 30 dias).
- Texto do usuário é sempre renderizado como texto (sem HTML livre), por isso DOMPurify não é necessário; ainda assim removemos caracteres de controle no servidor.
- CSP com `'unsafe-inline'` em scripts (bootstrap do Next sem nonce). Trocar por CSP com nonce via middleware é uma melhoria futura.
- IPs nunca são gravados em claro (HMAC truncado).
- Moderação de entrada por lista de termos com casamento por início de palavra (evita “computação” → “puta”), além das regras no prompt.

## Pagamentos
- Valor mínimo após cupom: R$ 1,00. O plano selecionado nunca pode ser inferior ao exigido pelo conteúdo.
- Endereço personalizado (Premium) é escolhido no checkout e aplicado na aprovação; se outra pessoa pegar o mesmo endereço nesse meio-tempo, usamos o slug aleatório.
- Renovação: um novo pagamento aprovado de página já ativa soma o período ao vencimento atual.
- Pagamento aprovado com valor menor que o do pedido **não** libera a página (log de erro).
- A tela de pagamento consulta o provedor diretamente a cada 15 s enquanto pendente (além do webhook e do cron) — cobre ambientes sem URL pública.
- SSE com fechamento após ~280 s; o cliente cai para polling de 3 s se o stream cair.

## Página pública
- Metadados e imagem OG **genéricos** (“Uma surpresa para você”), nas cores do tema, sem nomes nem fotos.
- Vídeo do YouTube com fachada (carrega o iframe só no clique) para manter a performance.
- O player do YouTube é carregado antes do clique na porta e tocado dentro do gesto do usuário; se o navegador ainda bloquear, o botão de play pulsa.
- Céu estrelado: cálculo próprio (≈90 estrelas mais brilhantes + 11 constelações, inclusive Cruzeiro do Sul), fuso aproximado pela longitude. Sem precessão/refração — suficiente para fins decorativos.
- Notificação de abertura: só na **primeira** abertura (campo `firstOpenedAt`); respostas do pedido e cupons resgatados notificam uma vez.

## Operação
- Retenção LGPD: rascunhos não pagos (e excluídos) com mais de 30 dias são apagados com as fotos; uploads abandonados após 24 h.
- Exclusão pelo cliente: apaga fotos e eventos, zera o conteúdo e mantém apenas o registro mínimo do pedido (obrigação fiscal).
- Depoimentos da landing marcados como ilustrativos; termos e privacidade são rascunhos com placeholders.
