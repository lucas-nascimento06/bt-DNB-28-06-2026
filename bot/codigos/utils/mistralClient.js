import fetch from 'node-fetch';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

const SYSTEM_PROMPT = `Você é uma participante de um grupo de WhatsApp chamado "Damas da Night".
Seu nome é Princesinha. Você é descontraída, carinhosa e fala como uma pessoa real — sem formalidade.
Use gírias leves, emoji com moderação, e responda de forma curta e natural.
Se falarem sobre um assunto, entre na conversa como se fosse uma amiga do grupo.
NUNCA diga que é um bot ou IA. Nunca use asteriscos para negrito. Máximo 3 linhas por resposta.

IMPORTANTE SOBRE GÊNERO:
- O grupo tem homens e mulheres. Você NÃO sabe o gênero de quem está falando.
- NUNCA use palavras generificadas como "lindo", "linda", "gato", "gata", "querida", "querido" sem ter certeza.
- Use sempre termos NEUTROS: "amor", "meu bem", "gente", "pessoa", "você", "mozão", "bb".
- Exemplos corretos: "que isso amor 😂", "nossa bb que situação", "gente que loucura".
- Exemplos ERRADOS: "ai linda", "que isso querida", "kkkk gato".`;

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
Responda como Princesinha, de forma curta, carinhosa mas firme, pedindo respeito no grupo.
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
    console.error('❌ [Princesinha] Erro ao gerar aviso ofensivo:', err.message);
    return '🛑 Sem ofensa aqui, bora se respeitar! 💛';
  }
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
  console.log(`🟢 [Princesinha] IA ativada no grupo: ${groupId}`);
}

export function pausarIA(groupId) {
  gruposAtivos.delete(groupId);
  console.log(`🔴 [Princesinha] IA pausada no grupo: ${groupId}`);
}

export function isIAAtiva(groupId) {
  return gruposAtivos.has(groupId);
}

// ============================================
// ⏱️ DELAY HUMANO
// ============================================
function delayHumano() {
  const ms = Math.floor(Math.random() * (25000 - 8000 + 1)) + 8000;
  console.log(`⏱️ [Princesinha] Aguardando ${ms / 1000}s antes de responder...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 🎲 CHANCE DE RESPONDER (não responde sempre)
// ============================================
function deveResponder() {
  // 45% de chance de responder — mais humano, menos invasiva
  return Math.random() < 0.45;
}

// ============================================
// 🤖 RESPOSTA NATURAL
// ============================================
export async function responderNaturalmente(userId, textoUsuario) {
  try {
    const status = verificarConteudo(textoUsuario);

    if (status === 'proibido') {
      console.warn(`🚨 [Princesinha] Conteúdo proibido detectado de ${userId}`);
      await delayHumano();
      return AVISO_PROIBIDO;
    }

    if (status === 'ofensivo') {
      console.warn(`⚠️ [Princesinha] Conteúdo ofensivo detectado de ${userId}`);
      await delayHumano();
      return await gerarAvisoOfensivo();
    }

    // 👋 Ignorar saudações simples
    const saudacoes = /^(oi|olá|ola|hey|boa tarde|bom dia|boa noite|eai|e aí|salve|tudo bem|td bem|e ai|oii|oiii|👋)[!?.🙂😊]*$/i;
    if (saudacoes.test(textoUsuario.trim())) {
      console.log(`👋 [Princesinha] Saudação ignorada de ${userId}`);
      return null;
    }

    // 🎲 Decidir se vai responder dessa vez
    if (!deveResponder()) {
      console.log(`🎲 [Princesinha] Optou por não responder desta vez (${userId})`);
      return null;
    }

    // ⏱️ Esperar antes de responder
    await delayHumano();

    if (!historicos.has(userId)) {
      historicos.set(userId, []);
    }
    const historico = historicos.get(userId);

    historico.push({ role: 'user', content: textoUsuario });

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
    console.error('❌ [Princesinha] Erro:', err.message);
    return null;
  }
}