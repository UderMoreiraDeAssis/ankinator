#!/usr/bin/env node
/**
 * Script standalone para extrair questões de PDF e gerar CSV
 *
 * Uso: node scripts/extract-from-pdf.js [caminho-do-pdf] [max-questoes]
 *
 * Exemplo:
 *   node scripts/extract-from-pdf.js ../curso-230987-aula-01-grifado-a09d.pdf 30
 */

const fs = require('fs').promises;
const path = require('path');
const PDFParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');

// Configuração
const PDF_PATH = process.argv[2] || path.join(__dirname, '../../curso-230987-aula-01-grifado-a09d.pdf');
const MAX_QUESTIONS = parseInt(process.argv[3]) || 30;
const OUTPUT_PATH = path.join(
  path.dirname(PDF_PATH),
  path.basename(PDF_PATH, '.pdf') + '-questoes.csv'
);

// Prompt rigoroso de extração (igual ao do servidor MCP)
const EXTRACTION_PROMPT = `Quando receber um PDF de aula, sua única tarefa é extrair questões e respostas fidedignas para uso no Anki.

Regras estritas:

1. Não interprete, não expanda, não exemplifique além do texto.
2. Não gere conteúdo baseado em conhecimento externo.
3. Se o trecho for vago ou incompleto, não complete — sinalize a lacuna.
4. Toda informação nas respostas deve ser diretamente verificável no PDF.
5. Formato de saída: lista com Q: e A:, uma por linha.

Risco crítico: Qualquer distorção levará o usuário a memorizar conteúdo incorreto.

Identidade do usuário: default_user
Objetivo declarado: Estudar com flashcards 100% alinhados ao material original.`;

/**
 * Extrai texto de PDF
 */
async function extractPdfText(pdfPath) {
  console.log(`📄 Lendo PDF: ${pdfPath}`);
  const dataBuffer = await fs.readFile(pdfPath);
  const data = await PDFParse(dataBuffer);
  console.log(`✅ PDF lido com sucesso (${data.numpages} páginas, ${data.text.length} caracteres)`);
  return data.text;
}

/**
 * Parseia questões do formato Q:/A: para array
 */
function parseQuestionsFromText(text) {
  const lines = text.split('\n');
  const questions = [];
  let currentQ = null;
  let currentA = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:')) {
      // Se já temos uma questão completa, salva antes de começar nova
      if (currentQ && currentA) {
        questions.push({ pergunta: currentQ, resposta: currentA });
      }
      currentQ = trimmed.substring(2).trim();
      currentA = null;
    } else if (trimmed.startsWith('A:')) {
      currentA = trimmed.substring(2).trim();
    } else if (trimmed && currentA) {
      // Continua resposta em múltiplas linhas
      currentA += ' ' + trimmed;
    } else if (trimmed && currentQ && !currentA) {
      // Continua pergunta em múltiplas linhas
      currentQ += ' ' + trimmed;
    }
  }

  // Adiciona última questão se existir
  if (currentQ && currentA) {
    questions.push({ pergunta: currentQ, resposta: currentA });
  }

  return questions;
}

/**
 * Converte questões para CSV
 */
function convertToCSV(questions) {
  const header = 'pergunta,resposta,opcoes,dificuldade,categoria';
  const rows = questions.map(q => {
    // Escapa aspas e adiciona aspas em campos com vírgulas/quebras de linha
    const escapePergunta = `"${q.pergunta.replace(/"/g, '""')}"`;
    const escapeResposta = `"${q.resposta.replace(/"/g, '""')}"`;
    return `${escapePergunta},${escapeResposta},,,`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Função principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando extração de questões do PDF\n');
    console.log(`📋 Configuração:`);
    console.log(`   PDF: ${PDF_PATH}`);
    console.log(`   Máx. questões: ${MAX_QUESTIONS}`);
    console.log(`   Saída: ${OUTPUT_PATH}\n`);

    // 1. Verificar API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ERRO: ANTHROPIC_API_KEY não configurada');
      console.error('');
      console.error('Configure a variável de ambiente antes de executar:');
      console.error('  export ANTHROPIC_API_KEY="sua-api-key-aqui"');
      console.error('');
      process.exit(1);
    }

    const anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log('✅ API key configurada\n');

    // 2. Verificar se PDF existe
    try {
      await fs.access(PDF_PATH);
    } catch (err) {
      console.error(`❌ ERRO: PDF não encontrado em ${PDF_PATH}`);
      process.exit(1);
    }

    // 3. Extrair texto do PDF
    const pdfText = await extractPdfText(PDF_PATH);

    if (!pdfText || pdfText.trim().length === 0) {
      console.error('❌ ERRO: PDF não contém texto extraível (pode ser escaneado)');
      console.error('   Solução: Use PDF com texto selecionável ou aplique OCR primeiro');
      process.exit(1);
    }

    // 4. Limitar texto para evitar excesso de tokens
    const maxChars = 50000;
    const textToProcess = pdfText.length > maxChars
      ? pdfText.substring(0, maxChars) + '\n\n[PDF truncado para processamento]'
      : pdfText;

    if (pdfText.length > maxChars) {
      console.log(`⚠️  Aviso: PDF truncado de ${pdfText.length} para ${maxChars} caracteres`);
    }

    // 5. Chamar Claude API para extração
    console.log(`\n🤖 Chamando Claude API para extrair questões...`);
    console.log(`   Modelo: claude-3-5-sonnet-20241022`);
    console.log(`   Tokens máx: 4096\n`);

    const response = await anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: EXTRACTION_PROMPT,
      messages: [{
        role: 'user',
        content: `Extraia até ${MAX_QUESTIONS} questões e respostas do seguinte texto de PDF:\n\n${textToProcess}`
      }]
    });

    const questoesText = response.content[0].type === 'text' ? response.content[0].text : '';

    // 6. Parsear questões
    console.log('📝 Parseando questões extraídas...');
    const parsedQuestions = parseQuestionsFromText(questoesText);

    if (parsedQuestions.length === 0) {
      console.error('❌ ERRO: Nenhuma questão foi extraída');
      console.error('');
      console.error('Possíveis causas:');
      console.error('  - PDF não contém pares de pergunta/resposta claros');
      console.error('  - Conteúdo é muito conceitual sem questões explícitas');
      console.error('  - Formato do PDF não é adequado para extração automática');
      console.error('');
      console.error('Resposta da API (primeiros 500 caracteres):');
      console.error(questoesText.substring(0, 500));
      process.exit(1);
    }

    console.log(`✅ ${parsedQuestions.length} questões parseadas com sucesso\n`);

    // 7. Converter para CSV
    console.log('📊 Convertendo para CSV...');
    const csvContent = convertToCSV(parsedQuestions);

    // 8. Salvar arquivo
    console.log(`💾 Salvando em: ${OUTPUT_PATH}`);
    await fs.writeFile(OUTPUT_PATH, csvContent, 'utf8');

    // 9. Relatório final
    console.log('\n✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO!\n');
    console.log('📊 Estatísticas:');
    console.log(`   Questões extraídas: ${parsedQuestions.length}`);
    console.log(`   Arquivo CSV: ${OUTPUT_PATH}`);
    console.log(`   Tamanho: ${Math.round(csvContent.length / 1024)} KB`);
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('   1. Revisar o CSV gerado (recomendado)');
    console.log('   2. Validar com: node tests/integration-test.js');
    console.log('   3. Importar no Anki usando o add-on Ankimon');
    console.log('');
    console.log('⚠️  IMPORTANTE: Revisão manual recomendada antes da importação final!');

    // 10. Mostrar preview das primeiras 3 questões
    console.log('\n📝 Preview (primeiras 3 questões):');
    console.log('─'.repeat(80));
    for (let i = 0; i < Math.min(3, parsedQuestions.length); i++) {
      const q = parsedQuestions[i];
      console.log(`\n${i + 1}. Q: ${q.pergunta}`);
      console.log(`   A: ${q.resposta}`);
    }
    console.log('\n' + '─'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERRO durante execução:');
    console.error(error.message);
    if (error.status) {
      console.error(`   Status HTTP: ${error.status}`);
    }
    if (error.error?.type) {
      console.error(`   Tipo: ${error.error.type}`);
    }
    process.exit(1);
  }
}

// Executa
main();
