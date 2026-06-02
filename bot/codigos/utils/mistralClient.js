import fetch from 'node-fetch';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

const SYSTEM_PROMPT = `Você é uma participante de um grupo de WhatsApp chamado "Damas da Night".
Seu nome é Maya Kyteler. Você é descontraída, carinhosa e fala como uma pessoa real — sem formalidade.
Use gírias leves, emoji com moderação, e responda de forma curta e natural.
Se falarem sobre um assunto, entre na conversa como se fosse uma amiga respondendo diretamente à pessoa.
NUNCA diga que é um bot ou IA. Nunca use asteriscos para negrito. Máximo 3 linhas por resposta.

IMPORTANTE SOBRE COMO FALAR:
- Você está sempre respondendo UMA pessoa, nunca um grupo.
- NUNCA use "gente", "pessoal", "vocês" ou palavras no plural.
- Fale de forma natural — NÃO force termos carinhosos como "mozao", "bb", "amor" em toda resposta.
- De vez em quando use termos carinhosos de forma natural: "mozao", "xuxu", "bb", "amor" — mas não em toda mensagem, só quando fizer sentido no contexto.
- Exemplos corretos: "kkk é verdade", "nossa que situação", "tô aqui sim 😄".
- Exemplos ERRADOS: forçar "mozao" ou "amor" em toda mensagem.

IMPORTANTE SOBRE GÊNERO:
- Você NÃO sabe o gênero de quem está falando.
- NUNCA use palavras generificadas como "lindo", "linda", "gato", "gata", "querida", "querido".
- Apelidos neutros permitidos: "mozao", "xuxu", "bb", "amor" — use com naturalidade, não force.

IMPORTANTE SOBRE HORÁRIO:
- Você receberá o horário atual do Brasil no início de cada mensagem.
- Use isso pra contextualizar suas respostas. Se é de manhã, responda "bom dia" se fizer sentido. Se é tarde da noite, demonstre isso naturalmente.
- Não mencione o horário diretamente a não ser que seja relevante.`;

// ============================================
// 🚨 MODERAÇÃO DE CONTEÚDO
// ============================================
const PALAVRAS_PROIBIDAS = [
  'pedofilia', 'pedófilo', 'zoofilia', 'estupro', 'abuso infantil',
  'criança nua', 'menor de idade', 'cp ', 'gore', 'snuff',
];

const PALAVROES_GRAVES = [
  'viado', 'viadinho', 'bicha', 'macaco', 'negão', 'judeu',
];

function verificarConteudo(texto) {
  const lower = texto.toLowerCase();
  for (const palavra of PALAVRAS_PROIBIDAS) {
    if (lower.includes(palavra)) return 'proibido';
  }
  for (const palavra of PALAVROES_GRAVES) {
    if (lower.includes(palavra)) return 'ofensivo';
  }
  return 'ok';
}

const AVISO_PROIBIDO =
  '⚠️ Ei, isso aqui não rola! Esse tipo de assunto é totalmente proibido no grupo. Respeito é o mínimo! 🚫';

const AVISO_OFENSIVO_PROMPT = `Alguém no grupo usou uma palavra ofensiva ou xingamento.
Responda como Maya Kyteler, de forma curta, carinhosa mas firme, pedindo respeito no grupo.
Não use asteriscos. Máximo 2 linhas.`;

async function gerarAvisoOfensivo() {
  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: AVISO_OFENSIVO_PROMPT },
        ],
        max_tokens: 80,
        temperature: 0.9,
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '🛑 Sem ofensa aqui, bora se respeitar! 💛';
  } catch (err) {
    console.error('❌ [Maya Kyteler] Erro ao gerar aviso ofensivo:', err.message);
    return '🛑 Sem ofensa aqui, bora se respeitar! 💛';
  }
}

// ============================================
// 🕐 PERÍODO DO DIA (horário de Brasília)
// ============================================
function getPeriodoDia() {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours();

  let periodo;
  if (hora >= 5 && hora < 12) periodo = 'manhã';
  else if (hora >= 12 && hora < 18) periodo = 'tarde';
  else if (hora >= 18 && hora < 23) periodo = 'noite';
  else periodo = 'madrugada';

  return `[Contexto de horário: agora são ${agora}, período: ${periodo}]`;
}

// ============================================
// 📝 HISTÓRICO POR USUÁRIO
// ============================================
const historicos = new Map();
const MAX_HISTORICO = 10;

// ============================================
// 🔴🟢 CONTROLE DE GRUPOS
// ============================================
const gruposAtivos = new Set();

export function ativarIA(groupId) {
  gruposAtivos.add(groupId);
  console.log(`🟢 [Maya Kyteler] IA ativada no grupo: ${groupId}`);
}

export function pausarIA(groupId) {
  gruposAtivos.delete(groupId);
  console.log(`🔴 [Maya Kyteler] IA pausada no grupo: ${groupId}`);
}

export function isIAAtiva(groupId) {
  return gruposAtivos.has(groupId);
}

// ============================================
// ⏱️ DELAY HUMANO — entre 30 e 60 segundos
// ============================================
function delayHumano() {
  const ms = Math.floor(Math.random() * (25000 - 20000 + 1)) + 20000;
  console.log(`⏱️ [Maya Kyteler] Aguardando ${ms / 1000}s antes de responder...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 🤖 RESPOSTA NATURAL
// ============================================
export async function responderNaturalmente(userId, textoUsuario) {
  try {
    const status = verificarConteudo(textoUsuario);

    if (status === 'proibido') {
      console.warn(`🚨 [Maya Kyteler] Conteúdo proibido detectado de ${userId}`);
      await delayHumano();
      return AVISO_PROIBIDO;
    }

    if (status === 'ofensivo') {
      console.warn(`⚠️ [Maya Kyteler] Conteúdo ofensivo detectado de ${userId}`);
      await delayHumano();
      return await gerarAvisoOfensivo();
    }

    // ⏱️ Esperar antes de responder
    await delayHumano();

    if (!historicos.has(userId)) {
      historicos.set(userId, []);
    }
    const historico = historicos.get(userId);

    // Adiciona contexto de horário na mensagem do usuário
    const periodoAtual = getPeriodoDia();
    const mensagemComContexto = `${periodoAtual}\n${textoUsuario}`;

    historico.push({ role: 'user', content: mensagemComContexto });

    if (historico.length > MAX_HISTORICO) {
      historico.splice(0, historico.length - MAX_HISTORICO);
    }

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...historico,
        ],
        max_tokens: 150,
        temperature: 0.85,
      }),
    });

    const data = await response.json();
    const resposta = data.choices?.[0]?.message?.content?.trim();

    if (resposta) {
      historico.push({ role: 'assistant', content: resposta });
    }

    return resposta ?? null;

  } catch (err) {
    console.error('❌ [Maya Kyteler] Erro:', err.message);
    return null;
  }
}