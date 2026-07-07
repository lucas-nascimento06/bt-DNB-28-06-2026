// 🎵 EXTRATOR DE LETRA — busca por nome da música
import Genius from 'genius-lyrics-axios';

// ============================================
// 🎵 INICIALIZA CLIENTE DE LETRAS
// ============================================
let lyricsClient = null;

function getLyricsClient() {
    if (!lyricsClient) {
        try {
            // Sem chave = modo scraping (funciona sem API key da Genius)
            lyricsClient = new Genius.Client();
        } catch (error) {
            console.warn('⚠️ Erro ao inicializar cliente de letras:', error.message);
            lyricsClient = null;
        }
    }
    return lyricsClient;
}

// ============================================
// 🧹 LIMPA LIXO DO SCRAPING (header do Genius, "You might also like" etc.)
// ============================================
function limparLetra(letraBruta) {
    if (!letraBruta) return letraBruta;

    let letra = letraBruta;

    // Remove cabeçalho tipo "12 ContributorsNome da Música Lyrics"
    // (o Genius injeta isso no topo da página, antes da letra real)
    letra = letra.replace(/^\s*\d*\s*Contributors?.*?Lyrics\s*/is, '');

    // Caso o título/nome da música apareça duplicado logo no início
    // (padrão comum quando o scraper pega texto extra do <title> da página)
    letra = letra.replace(/^\s*Contributors?.*?Lyrics\s*/is, '');

    // Remove o rodapé "You might also likeEmbed" que o scraper às vezes pega
    letra = letra.replace(/You might also like.*$/is, '');
    letra = letra.replace(/\d*Embed$/i, '');

    return letra.trim();
}

// ============================================
// 🎵 BUSCA LETRA POR NOME (letra completa + capa)
// Retorna { letra, imagemUrl } ou null se não achar nada
// ============================================
async function buscarLetraPorNome(musica, artista) {
    try {
        const client = getLyricsClient();
        if (!client) throw new Error('Cliente de letras não disponível');

        // Tenta primeiro com artista + música (se tiver artista)
        const tentativas = artista
            ? [`${artista} ${musica}`, musica]
            : [musica];

        for (const query of tentativas) {
            console.log(`🔍 Buscando: "${query}"`);
            const searches = await client.songs.search(query);
            if (searches && searches.length > 0) {
                const song = searches[0];
                const lyrics = await song.lyrics();
                if (lyrics) {
                    // A lib guarda a capa em campos diferentes dependendo da versão,
                    // então tenta todos os nomes conhecidos.
                    const imagemUrl =
                        song.image || song.thumbnail || song.header_image_url || null;

                    return { letra: limparLetra(lyrics), imagemUrl };
                }
            }
        }

        return null;
    } catch (error) {
        console.error('❌ Erro ao buscar letra:', error.message);
        return null;
    }
}

// ============================================
// 🔗 WRAPPER EXPORTADO — usado pelo musicaHandler.js
// Recebe (autor, titulo) e repassa na ordem que
// buscarLetraPorNome espera (musica, artista)
// ============================================
export async function buscarLetra(autor, titulo) {
    const resultado = await buscarLetraPorNome(titulo, autor);
    return resultado ? resultado.letra : null;
}