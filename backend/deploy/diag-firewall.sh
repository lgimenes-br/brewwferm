#!/usr/bin/env bash
# ============================================================================
# Diagnostico SOMENTE LEITURA do firewall da VPS (rodado pelo deploy).
# Objetivo: saber se portas novas (ex: 8883 para MQTT com TLS) sao bloqueadas
# pelo firewall da propria VPS (ufw/iptables/nftables) ou por um firewall
# externo do provedor. Nao altera nada.
# ============================================================================
set -uo pipefail
log() { echo "[firewall] $*"; }

if command -v ufw >/dev/null 2>&1; then
  log "ufw:"
  ufw status verbose 2>&1 | sed 's/^/[firewall]   /'
else
  log "ufw: nao instalado"
fi

if command -v iptables >/dev/null 2>&1; then
  log "iptables INPUT (politica e regras):"
  iptables -S INPUT 2>&1 | head -40 | sed 's/^/[firewall]   /'
  log "iptables: total de regras em todas as chains: $(iptables -S 2>/dev/null | wc -l)"
fi

if command -v nft >/dev/null 2>&1; then
  log "nftables: chains com hook input:"
  nft list ruleset 2>/dev/null | grep -nE "hook input|policy|dport" | head -30 | sed 's/^/[firewall]   /'
fi

if command -v firewall-cmd >/dev/null 2>&1; then
  log "firewalld: $(firewall-cmd --state 2>&1)"
  firewall-cmd --list-all 2>&1 | sed 's/^/[firewall]   /'
fi

log "portas TCP escutando:"
(ss -tlnH 2>/dev/null || netstat -tln 2>/dev/null) | awk '{print $4}' | sort -u | sed 's/^/[firewall]   /'
exit 0
