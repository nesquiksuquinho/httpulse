<div align="center">

# ⚡ httpulse

**o canivete suíço definitivo pra apis e testes de rede no terminal**

Monitore a saúde das suas APIs, faça auditorias de segurança, descubra subdomínios, rastreie IPs e muito mais, direto no seu terminal com gráficos em tempo real.

[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-orange)](./LICENSE)

</div>

---

## Eae 👋

**httpulse** é uma CLI que criei pra quem precisa debugar API e rede muito rápido, sem burocracia e com a interface mais bonita possível pro terminal. Feito pelo **[nesquiksuquinho](https://github.com/nesquiksuquinho)**.

O que ele sabe fazer:

- 🔍 **Saúde Rápida:** Digite uma URL e saiba instantaneamente status, tempo de DNS, TTFB, tamanho da resposta. (auto-detecta HTTP/HTTPS)
- 📊 **Monitoramento ao Vivo:** Gráficos estilo *sparkline* pra acompanhar a latência do servidor em tempo real
- 🌍 **Geo IP:** Descubra país, região, provedor (ISP) e até o link do Google Maps da sua API
- 🔌 **Scan de Portas:** Escaneia as portas mais comuns de um servidor rapidinho
- 🔗 **Rastreio de Redirects:** Veja toda a jornada de uma requisição acompanhando redirecionamentos (301, 302, etc)
- 🔒 **Inspeção de SSL:** Validade, emissor e status detalhado do certificado TLS
- 🌐 **Auditoria de DNS e Subdomínios:** Consulta A, AAAA, MX, NS e descobre subdomínios escondidos
- 🛡️ **Segurança:** Analisa os headers HTTP procurando por falhas (HSTS, CSP, etc)

---

## Instalação

Como o projeto é feito em TypeScript purão, é só clonar e linkar globalmente na sua máquina:

```bash
# clona a fita
git clone https://github.com/nesquiksuquinho/httpulse.git
cd httpulse

# instala o basico
npm install

# constroi o binario
npm run build

# linka o comando 'httpulse' pra qualquer lugar do seu terminal
npm link
```

Pronto, testadão! O comando `httpulse` tá no ar.

---

## Modo Dashboard Interativa

O jeito mais massa de usar. No terminal, digite só `httpulse` e cai na interface (REPL).

```bash
httpulse
```

Ali dentro, vc brinca:

```
httpulse › api.github.com              # verifica a saude na hora
httpulse › probe google.com 3s         # fica monitorando c/ graficos a cada 3s
httpulse › ping google.com 10          # faz 10 pings diretos pra ver jitter/min/max
httpulse › comparar google.com g1.com  # faz corrida de latencia entre ate 10 urls
httpulse › geo github.com              # ve onde o IP servidor ta hospedado
httpulse › tech github.com             # descobre o stack tecnologico (react, next, wordpress, etc)
httpulse › portas localhost            # da um scan nas portas abertas
httpulse › redirects bit.ly/xxx        # ve onde o bitly vai te jogar
httpulse › headers github.com          # audita seguranca dos cabecalhos
httpulse › ssl cloudflare.com          # inspeciona certificado
httpulse › subdominios apple.com       # acha subdominios ativos
```

---

## Usando via CLI Direto

Vc tambem pode usar tudo isso chamando os comandos diretamente via bash/zsh pra botar em scripts:

### Tiro Único
```bash
httpulse check api.github.com
```

### Deixar Monitorando
```bash
# Monitora a cada 2 segs com dashboard interativo
httpulse probe api.github.com --interval 2s --dashboard
```

O dashboard é bizarro de bonitu:

```
  ● api.github.com https://api.github.com
  Status:  ●●●●●●●●●●●●●●●●◐●●●
  Latência: ▂▃▂▄▃▅▃▂▃▄▂▃▅▃▂▄▃▂▃▂
  Uptime:  99.5%  Avg: 145ms  P95: 312ms  Probes: 24
```

### Relatórios em HTML, Markdown ou JSON

Rodou muito tempo? Pode cuspir isso em relatorio parseadinho:

```bash
# gera um HTML lindo
httpulse report -i sessao.json -f html -o relatorio.html

# gera Markdown pro seu README
httpulse report -i sessao.json -f markdown -o relatorio.md
```

---

## Tecnologias

Feito pra ser bruto e sem Vibe Code. **Zero frescura.** 😼

- **TypeScript 5** — Strict mode no talo, código todo tipado e sem 1 `any`.
- **Node 20+**
- **Undici** — Motor HTTP monstrão (muito mais rapido q o fetch/axios).
- **Chalk / cli-table3** — Pra deixar tudo bonitāo e formatado.

---

## Desinstalar

Enjoou? Só limpar tudo:

```bash
npm unlink -g httpulse
```

Valeu por testar! ⚡

---

## 🤝 Contato / Discord

Se curtiu a ferramenta ou tem alguma ideia insana, me chama no Discord:
**[nesquiksuquinho](https://discord.com/users/1424887348046594159)**

---

## ⚠️ Aviso Legal / Disclaimer

**Esta ferramenta foi criada estritamente com propósitos educativos e de depuração de redes autorizadas.**

O `httpulse` **não** foi feito, nem possui intenção ou malícia para ser utilizado em ataques de negação de serviço (DDoS), invasões, ou qualquer tipo de exploração não autorizada. O autor não se responsabiliza pelo mau uso das funcionalidades de sondagem ou mapeamento de rede fornecidas pela aplicação. Use com responsabilidade.
