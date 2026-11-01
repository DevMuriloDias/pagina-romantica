import { BRAND } from "@/config";

export const metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <>
      <h1>Termos de Uso</h1>
      <p>Última atualização: 1º de novembro de 2026</p>
      <p>
        Estes Termos regulam o uso do {BRAND.name}, serviço oferecido por Murilo Rafael Dias Ferreira, inscrito no CPF sob o nº 098.855.649-93 (“nós”). Ao criar uma página, você concorda com estes Termos.
      </p>
      <h2>1. O serviço</h2>
      <p>O {BRAND.name} permite criar páginas personalizadas (“Páginas”) com textos, fotos, músicas e outros recursos, e compartilhá-las por um link privado após o pagamento.</p>
      <h2>2. Conteúdo do usuário</h2>
      <ul>
        <li>Você é responsável por todo o conteúdo que enviar e declara ter os direitos e autorizações necessários, inclusive das pessoas que aparecem nas fotos.</li>
        <li>É proibido publicar conteúdo sexual explícito, ilegal, ofensivo, discriminatório, que viole direitos de terceiros ou que envolva menores de idade de forma inadequada.</li>
        <li>Podemos despublicar Páginas que violem estes Termos, especialmente após denúncias, sem direito a reembolso em caso de violação.</li>
      </ul>
      <h2>3. Textos sugeridos</h2>
      <p>Os textos iniciais sugeridos pelo {BRAND.name} são um ponto de partida. Revise tudo antes de publicar; você é o(a) autor(a) final da Página.</p>
      <h2>4. Pagamento, validade e reembolso</h2>
      <ul>
        <li>O pagamento é único, processado pelo Mercado Pago. O valor é exibido antes da confirmação.</li>
        <li>A validade da Página depende do plano contratado (ex.: 1 ano ou vitalícia — “vitalícia” significa enquanto o serviço estiver em operação).</li>
        <li>Direito de arrependimento: você pode desistir da compra em até 7 (sete) dias a partir do pagamento, conforme o art. 49 do Código de Defesa do Consumidor, pedindo o reembolso pelo e-mail {BRAND.supportEmail}. Em caso de reembolso ou estorno, a Página é despublicada.</li>
      </ul>
      <h2>5. Links de acesso</h2>
      <p>O link público e o link de edição são pessoais. Guarde-os com cuidado — quem tiver o link de edição pode alterar a Página.</p>
      <h2>6. Música e conteúdos de terceiros</h2>
      <p>Músicas e vídeos são exibidos por meio dos players oficiais do YouTube e do Spotify, sujeitos aos termos dessas plataformas.</p>
      <h2>7. Limitação de responsabilidade</h2>
      <p>Fazemos o possível para manter o serviço disponível e seguro, mas não garantimos funcionamento ininterrupto nem livre de falhas de terceiros (como provedores de hospedagem, pagamento ou as plataformas YouTube e Spotify). Não nos responsabilizamos pelo conteúdo inserido pelos usuários nem por perdas decorrentes do compartilhamento dos links pelo próprio usuário. Em caso de falha do serviço que impeça o uso da Página contratada, nossa responsabilidade fica limitada ao valor pago por ela.</p>
      <h2>8. Foro</h2>
      <p>Estes Termos seguem a legislação brasileira. Eventuais disputas serão resolvidas no foro do domicílio do consumidor, conforme o Código de Defesa do Consumidor.</p>
      <p>Contato: {BRAND.supportEmail}</p>
    </>
  );
}
