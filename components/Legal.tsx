import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from './SiteChrome';

// Politica de privacidade (LGPD) e termos de uso. Texto base para revisao juridica antes do lancamento.
// O controlador aparece so como a marca Breww por enquanto (decisao do dono, 12/11/2026).

export const LEGAL_EMAIL = 'contato@breww.live';
export const LEGAL_UPDATED = '12 de novembro de 2026';

const Page: React.FC<{ title: string; intro: React.ReactNode; children: React.ReactNode }> = ({ title, intro, children }) => (
    <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-6 lg:pt-20">
            <h1 className="[font-family:var(--font-display)] text-[40px] font-light leading-[1.05] tracking-[-0.035em] sm:text-[52px]">{title}</h1>
            <p className="mt-4 text-sm text-[var(--muted)]">Atualizado em {LEGAL_UPDATED}</p>
            <div className="mt-6 text-lg leading-relaxed text-[#2b2f37]">{intro}</div>
            <div className="legal mt-12 space-y-10 text-[16px] leading-relaxed text-[#2b2f37] [&_h2]:[font-family:var(--font-display)] [&_h2]:text-[24px] [&_h2]:font-normal [&_h2]:tracking-[-0.02em] [&_h2]:text-[var(--ink)] [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_b]:font-medium [&_b]:text-[var(--ink)]">
                {children}
            </div>
            <p className="mt-14 border-t border-black/10 pt-6 text-sm text-[var(--muted)]">
                Dúvidas ou pedidos: <a className="underline underline-offset-4" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
                {' '}Veja também os <Link className="underline underline-offset-4" to={title.startsWith('Política') ? '/termos' : '/privacidade'}>{title.startsWith('Política') ? 'termos de uso' : 'política de privacidade'}</Link>.
            </p>
        </main>
        <SiteFooter />
    </div>
);

export const Privacy: React.FC = () => {
    useEffect(() => { document.title = 'Política de privacidade — Breww'; }, []);
    return (
        <Page title="Política de privacidade" intro={<p>Esta política explica quais dados o Breww (breww.live, o app para iOS e Android e o firmware do controlador) coleta, para que usa, com quem compartilha e como você exerce os seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>}>
            <section>
                <h2>1. Quem trata os seus dados</h2>
                <p>O Breww é o controlador dos dados pessoais tratados no serviço. Para qualquer assunto de privacidade, inclusive para falar com o encarregado, escreva para <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.</p>
            </section>
            <section>
                <h2>2. Dados que coletamos</h2>
                <ul>
                    <li><b>Conta:</b> nome, e-mail e senha (guardada só como hash, nunca em texto). Se você entra com o Google ou a Apple, recebemos o identificador da conta e o e-mail que o provedor informa.</li>
                    <li><b>Aparelhos:</b> número de série (o endereço MAC do Wi-Fi), placa, versão do firmware, sensores detectados, pinos configurados e o endereço IP público usado para vincular o aparelho à sua conta.</li>
                    <li><b>Leituras e lotes:</b> temperaturas, umidade, densidade e bateria do iSpindel, estado dos relés, sinal do Wi-Fi, lotes, perfis de fermentação, receitas importadas e anotações.</li>
                    <li><b>Biblioteca de perfis:</b> os perfis que você publica aparecem para outros usuários com o seu primeiro nome.</li>
                    <li><b>Notificações:</b> o token de notificação do celular ou do navegador.</li>
                    <li><b>Integrações que você ativa:</b> o endereço de envio do Brewfather e os dados do bot do Telegram.</li>
                    <li><b>Segurança e diagnóstico:</b> endereço IP e horário de logins e de ações administrativas, e registros técnicos dos aparelhos (reinícios, falhas de conexão, lentidão).</li>
                    <li><b>Erros técnicos:</b> quando o site, o app ou o servidor falham, registramos a mensagem do erro, a tela, o tipo de aparelho e a versão, sem o conteúdo dos seus lotes.</li>
                </ul>
            </section>
            <section>
                <h2>3. Para que usamos</h2>
                <ul>
                    <li>Prestar o serviço: mostrar as leituras, seguir os perfis, enviar alertas e atualizações de firmware.</li>
                    <li>Proteger a sua conta e os aparelhos, e investigar abusos.</li>
                    <li>Dar suporte e corrigir falhas.</li>
                    <li>Entender o uso de forma agregada para melhorar o Breww.</li>
                </ul>
                <p>Não vendemos dados pessoais e não usamos os seus dados para publicidade.</p>
            </section>
            <section>
                <h2>4. Bases legais</h2>
                <ul>
                    <li><b>Execução do contrato</b> (art. 7º, V): conta, aparelhos, leituras, lotes e alertas, sem os quais o serviço não funciona.</li>
                    <li><b>Legítimo interesse</b> (art. 7º, IX): segurança, diagnósticos e registro de erros.</li>
                    <li><b>Consentimento</b> (art. 7º, I): notificações, integrações, publicação na biblioteca e a análise com inteligência artificial, que você ativa e pode desativar quando quiser.</li>
                    <li><b>Cumprimento de obrigação legal</b> (art. 7º, II): guarda de registros de acesso exigida pelo Marco Civil da Internet.</li>
                </ul>
            </section>
            <section>
                <h2>5. Com quem compartilhamos</h2>
                <p>Só com os fornecedores necessários para o serviço funcionar, cada um com acesso apenas ao que precisa:</p>
                <ul>
                    <li><b>Locaweb</b> (Brasil): hospedagem do servidor e do banco de dados.</li>
                    <li><b>Expo, Apple e Google</b>: envio de notificações e login com Google ou Apple.</li>
                    <li><b>Resend</b>: envio de e-mails, como a recuperação de senha.</li>
                    <li><b>Google (Gemini)</b>: análise do lote com inteligência artificial, só quando você pede. Enviamos os dados do lote (estilo, densidades, temperaturas), sem nome ou e-mail.</li>
                    <li><b>Sentry</b>: registro de erros técnicos.</li>
                    <li><b>Brewfather e Telegram</b>: só se você ativar a integração, e só os dados que ela envia.</li>
                </ul>
                <p>Alguns desses fornecedores ficam fora do Brasil. Nesses casos a transferência segue o art. 33 da LGPD, com fornecedores que adotam garantias de proteção compatíveis. Também podemos compartilhar dados por ordem judicial ou exigência legal.</p>
            </section>
            <section>
                <h2>6. Por quanto tempo guardamos</h2>
                <ul>
                    <li><b>Conta e lotes:</b> enquanto a conta existir. Lotes encerrados há mais de 30 dias são resumidos para uma leitura a cada 15 minutos.</li>
                    <li><b>Leituras fora de um lote:</b> 30 dias.</li>
                    <li><b>Registros técnicos dos aparelhos:</b> 30 dias.</li>
                    <li><b>Registros de acesso</b> (endereço IP e horário de uso): 12 meses, acima dos 6 meses que o Marco Civil da Internet exige.</li>
                    <li><b>Conta excluída:</b> fica 30 dias desativada, para o caso de engano, e depois é apagada com os aparelhos, lotes e leituras. Cópias de segurança são substituídas em até 2 meses.</li>
                </ul>
            </section>
            <section>
                <h2>7. Segurança</h2>
                <p>A comunicação com o site, o app e os aparelhos usa criptografia (TLS). Cada aparelho tem uma chave própria, as senhas são guardadas com hash e o acesso administrativo é restrito e registrado. Nenhum sistema é totalmente imune a falhas; se houver um incidente que traga risco a você, avisaremos você e a ANPD como a lei manda.</p>
            </section>
            <section>
                <h2>8. Seus direitos</h2>
                <p>Você pode, a qualquer momento: confirmar se tratamos os seus dados e ter acesso a eles; corrigir dados incompletos ou errados; pedir a portabilidade (as leituras de cada lote podem ser exportadas em CSV no próprio app); pedir a exclusão; saber com quem compartilhamos; e revogar consentimentos.</p>
                <p>Para excluir a conta, use <b>Conta → Excluir conta</b> no app. Para os outros pedidos, escreva para <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>; respondemos em até 15 dias. Você também pode reclamar na Autoridade Nacional de Proteção de Dados (ANPD).</p>
            </section>
            <section>
                <h2>9. Menores de idade</h2>
                <p>O Breww é feito para quem produz cerveja e não é destinado a menores de 18 anos.</p>
            </section>
            <section>
                <h2>10. Cookies e armazenamento</h2>
                <p>O site guarda no navegador apenas o que precisa para você continuar conectado e as suas preferências. Não usamos cookies de publicidade nem de rastreamento de terceiros.</p>
            </section>
            <section>
                <h2>11. Mudanças nesta política</h2>
                <p>Se mudarmos algo importante, avisamos pelo app ou por e-mail antes de a mudança valer. A data no topo mostra a versão em vigor.</p>
            </section>
        </Page>
    );
};

export const Terms: React.FC = () => {
    useEffect(() => { document.title = 'Termos de uso — Breww'; }, []);
    return (
        <Page title="Termos de uso" intro={<p>Estes termos valem para o uso do site breww.live, do app Breww para iOS e Android e do serviço de nuvem que conversa com o controlador. Ao criar uma conta, você concorda com eles e com a <Link className="underline" to="/privacidade">política de privacidade</Link>.</p>}>
            <section>
                <h2>1. O serviço</h2>
                <p>O Breww permite acompanhar e controlar a temperatura de fermentação de cerveja com um controlador baseado em ESP32: mostra as leituras, segue perfis de fermentação, envia alertas e atualiza o firmware. O firmware é aberto e tem a sua própria licença (seção 8).</p>
            </section>
            <section>
                <h2>2. A sua conta</h2>
                <ul>
                    <li>Você precisa ter 18 anos ou mais.</li>
                    <li>Use dados verdadeiros e mantenha a sua senha em segredo. Você responde pelo que for feito com a sua conta.</li>
                    <li>Você pode excluir a conta quando quiser, em Conta → Excluir conta no app.</li>
                </ul>
            </section>
            <section>
                <h2>3. Planos</h2>
                <p>Durante o lançamento o Breww é gratuito, com até 3 fermentadores por conta. Planos pagos podem ser criados no futuro; se isso acontecer, você será avisado antes e nenhuma cobrança será feita sem a sua concordância.</p>
            </section>
            <section>
                <h2>4. Parte elétrica e segurança</h2>
                <p>O controlador aciona aparelhos ligados na tomada (110 ou 220 V), como geladeiras e aquecedores. A montagem, as ligações elétricas e a escolha dos componentes são feitas por você, por sua conta e risco. Faça a parte elétrica com tudo desligado, use caixa fechada e componentes adequados à carga e, se não tiver experiência, peça ajuda a um eletricista. O Breww fornece o software e as instruções; não fabrica, instala nem vende o seu hardware.</p>
            </section>
            <section>
                <h2>5. Limites do serviço</h2>
                <p>O controle de temperatura depende de energia elétrica, sensores, relés, Wi-Fi e da conexão com a internet, e qualquer um deles pode falhar. A placa segue o perfil mesmo sem internet, mas alertas e leituras no app dependem da conexão. Por isso:</p>
                <ul>
                    <li>Acompanhe os seus lotes e não dependa só dos alertas para proteger algo de valor.</li>
                    <li>O serviço pode ficar fora do ar para manutenção ou por falhas, e pode mudar com o tempo.</li>
                    <li>Na medida permitida pela lei, o Breww não responde por perda de lotes, danos a equipamentos ou prejuízos indiretos causados por falhas de hardware, de energia, de conexão ou por uso em desacordo com estes termos. Nada aqui afasta os direitos que o Código de Defesa do Consumidor garante a você.</li>
                </ul>
            </section>
            <section>
                <h2>6. Uso aceitável</h2>
                <p>Não use o Breww para atacar, sobrecarregar ou tentar acessar contas e aparelhos de outras pessoas, nem para publicar conteúdo ofensivo, ilegal ou enganoso. Falhas de segurança podem ser relatadas pelo canal descrito no repositório do firmware.</p>
            </section>
            <section>
                <h2>7. Biblioteca de perfis</h2>
                <p>Ao publicar um perfil na biblioteca, você declara que pode compartilhá-lo e autoriza o Breww a exibi-lo e os outros usuários a copiá-lo e usá-lo. O perfil aparece com o seu primeiro nome. Você pode removê-lo quando quiser. Perfis denunciados ou impróprios podem ser escondidos sem aviso. Antes de usar um perfil publicado por outra pessoa, confira as temperaturas e durações: ele não é revisado pelo Breww.</p>
            </section>
            <section>
                <h2>8. Firmware aberto e marca</h2>
                <p>O firmware do controlador é distribuído sob a licença GNU GPL 3.0 ou posterior, publicada no GitHub. O nome Breww, o logotipo e a identidade visual não fazem parte dessa licença e não podem ser usados em versões modificadas.</p>
            </section>
            <section>
                <h2>9. Suspensão e encerramento</h2>
                <p>Podemos suspender ou encerrar contas que violem estes termos ou coloquem o serviço ou outras pessoas em risco. Sempre que possível, avisamos antes e explicamos o motivo.</p>
            </section>
            <section>
                <h2>10. Mudanças nos termos</h2>
                <p>Se mudarmos estes termos de forma importante, avisamos pelo app ou por e-mail antes de a mudança valer.</p>
            </section>
            <section>
                <h2>11. Lei e foro</h2>
                <p>Estes termos seguem as leis do Brasil. Fica eleito o foro do domicílio do consumidor.</p>
            </section>
        </Page>
    );
};
