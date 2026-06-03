#!/usr/bin/env node

/**
 * Script para gerar fixtures de teste (CSVs e PDFs)
 * para validar as ferramentas do ankinator-mcp
 *
 * Schema CSV: pergunta,resposta,opcoes,dificuldade,categoria
 * Uso: node scripts/generate-fixtures.js
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Diretórios de destino
const CSV_DIR = path.join(__dirname, '..', 'examples', 'csv');
const PDF_DIR = path.join(__dirname, '..', 'examples', 'pdf');

// ============================================================================
// GERAÇÃO DE CSVs
// ============================================================================

function generateCSVs() {
  console.log('📝 Gerando CSVs de teste...\n');

  // 1. CSV Válido Mínimo (apenas campos obrigatórios)
  const validoMinimo = `pergunta,resposta
"O que é uma variável em programação?","Uma variável é um espaço na memória usado para armazenar dados que podem mudar durante a execução do programa"
"Qual a sintaxe básica para criar uma lista em Python?","A sintaxe é: lista = [] ou lista = list()"
"O que significa o operador == em Python?","O operador == compara se dois valores são iguais e retorna True ou False"`;

  fs.writeFileSync(path.join(CSV_DIR, 'valido_minimo.csv'), validoMinimo);
  console.log('✅ valido_minimo.csv criado (3 questões básicas)');

  // 2. CSV Válido Completo (todos os campos)
  const validoCompleto = `pergunta,resposta,opcoes,dificuldade,categoria
"O que é Python?","Python é uma linguagem de programação de alto nível, interpretada e de propósito geral","","facil","Programação"
"Quais são os tipos de dados básicos em Python?","Os tipos básicos são: int (inteiro), float (decimal), str (texto), bool (booleano) e None (nulo)","","facil","Programação"
"O que é uma função em programação?","Uma função é um bloco de código reutilizável que executa uma tarefa específica","","medio","Programação"
"Qual a diferença entre lista e tupla em Python?","Listas são mutáveis (podem ser modificadas) e usam colchetes [], enquanto tuplas são imutáveis e usam parênteses ()","","medio","Programação"
"O que é um dicionário em Python?","Um dicionário é uma estrutura de dados que armazena pares chave-valor, permitindo acesso rápido aos dados pela chave","","medio","Programação"
"Quanto é 2 + 2?","4","A) 3|B) 4|C) 5|D) 6","facil","Matemática"
"Qual a fórmula da área do círculo?","A = πr², onde r é o raio do círculo","","dificil","Matemática"
"O que significa DOM em programação web?","DOM (Document Object Model) é uma interface de programação que representa a estrutura de um documento HTML como uma árvore de objetos","","dificil","Programação"
"Qual a capital do Brasil?","Brasília","A) São Paulo|B) Rio de Janeiro|C) Brasília|D) Salvador","facil","Geografia"
"O que é recursão em programação?","Recursão é uma técnica onde uma função chama a si mesma para resolver um problema dividindo-o em subproblemas menores","","muito_dificil","Programação"`;

  fs.writeFileSync(path.join(CSV_DIR, 'valido_completo.csv'), validoCompleto);
  console.log('✅ valido_completo.csv criado (10 questões, todos os campos)');

  // 3. CSV Inválido - Campos vazios
  const invalidoCampos = `pergunta,resposta,opcoes,dificuldade,categoria
"O que é Python?","","","facil","Programação"
"Qual a sintaxe de um loop?","Um loop permite repetir código","","medio","Programação"`;

  fs.writeFileSync(path.join(CSV_DIR, 'invalido_campos.csv'), invalidoCampos);
  console.log('✅ invalido_campos.csv criado (erro: resposta vazia)');

  // 4. CSV Inválido - Dificuldade inválida
  const invalidoDificuldade = `pergunta,resposta,opcoes,dificuldade,categoria
"O que é programação?","Programação é o processo de criar instruções para computadores","","super_dificil","Programação"
"O que é HTML?","HTML é a linguagem de marcação para criar páginas web","","extremamente_dificil","Programação"`;

  fs.writeFileSync(path.join(CSV_DIR, 'invalido_dificuldade.csv'), invalidoDificuldade);
  console.log('✅ invalido_dificuldade.csv criado (erro: enum inválido)');

  console.log('\n✨ Todos os CSVs criados com sucesso!\n');
}

// ============================================================================
// GERAÇÃO DE PDFs
// ============================================================================

function generatePDFs() {
  console.log('📄 Gerando PDFs de teste...\n');

  // 1. PDF Simples - Introdução ao Python
  generatePythonPDF();

  // 2. PDF Matemática - Equações do Segundo Grau
  generateMatematicaPDF();

  console.log('\n✨ Todos os PDFs criados com sucesso!\n');
}

function generatePythonPDF() {
  const doc = new PDFDocument({ margin: 50 });
  const outputPath = path.join(PDF_DIR, 'sample_simples.pdf');

  doc.pipe(fs.createWriteStream(outputPath));

  // Página 1
  doc.fontSize(20).text('Introdução à Programação Python', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text('1. O que é Python?', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(
    'Python é uma linguagem de programação de alto nível, interpretada, de tipagem dinâmica e multiparadigma. ' +
    'Foi criada por Guido van Rossum em 1991 e é conhecida por sua sintaxe clara e legível, ' +
    'que favorece a produtividade do programador.',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.fontSize(11).text(
    'Python é amplamente utilizada em desenvolvimento web, ciência de dados, inteligência artificial, ' +
    'automação de tarefas e muitas outras áreas.',
    { align: 'justify' }
  );
  doc.moveDown(1.5);

  doc.fontSize(14).text('2. Variáveis em Python', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(
    'Uma variável é um espaço na memória do computador usado para armazenar dados que podem mudar ' +
    'durante a execução do programa. Em Python, não é necessário declarar o tipo da variável explicitamente.',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.fontSize(11).text('Sintaxe básica:', { bold: true });
  doc.fontSize(10).font('Courier').text('    nome_variavel = valor', { color: '#333333' });
  doc.font('Helvetica');
  doc.moveDown();

  doc.fontSize(11).text('Exemplos:');
  doc.fontSize(10).font('Courier').text('    idade = 25');
  doc.text('    nome = "Maria"');
  doc.text('    altura = 1.75');
  doc.text('    ativo = True');
  doc.font('Helvetica');
  doc.moveDown(1.5);

  // Página 2
  doc.addPage();

  doc.fontSize(14).text('3. Tipos de Dados Básicos', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text('Python possui vários tipos de dados fundamentais:');
  doc.moveDown();

  doc.fontSize(11).text('• int (inteiro):', { bold: true });
  doc.fontSize(10).text('  Números inteiros, como 1, 42, -10');
  doc.moveDown(0.5);

  doc.fontSize(11).text('• float (ponto flutuante):', { bold: true });
  doc.fontSize(10).text('  Números decimais, como 3.14, -0.5, 2.0');
  doc.moveDown(0.5);

  doc.fontSize(11).text('• str (string):', { bold: true });
  doc.fontSize(10).text('  Texto entre aspas, como "Python", \'Olá mundo\'');
  doc.moveDown(0.5);

  doc.fontSize(11).text('• bool (booleano):', { bold: true });
  doc.fontSize(10).text('  Valores lógicos True (verdadeiro) ou False (falso)');
  doc.moveDown(0.5);

  doc.fontSize(11).text('• None:', { bold: true });
  doc.fontSize(10).text('  Representa a ausência de valor');
  doc.moveDown(1.5);

  doc.fontSize(14).text('4. Operadores Básicos', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).text('Operadores aritméticos:');
  doc.fontSize(10).text('  + (adição), - (subtração), * (multiplicação), / (divisão)');
  doc.moveDown();

  doc.fontSize(11).text('Operadores de comparação:');
  doc.fontSize(10).text('  == (igual), != (diferente), > (maior), < (menor)');
  doc.fontSize(10).text('  >= (maior ou igual), <= (menor ou igual)');
  doc.moveDown();

  doc.fontSize(11).text('Operadores lógicos:');
  doc.fontSize(10).text('  and (e lógico), or (ou lógico), not (negação)');

  doc.end();
  console.log('✅ sample_simples.pdf criado (Introdução Python, 2 páginas)');
}

function generateMatematicaPDF() {
  const doc = new PDFDocument({ margin: 50 });
  const outputPath = path.join(PDF_DIR, 'sample_matematica.pdf');

  doc.pipe(fs.createWriteStream(outputPath));

  // Página 1
  doc.fontSize(20).text('Equações do Segundo Grau', { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(14).text('1. Definição', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(
    'Uma equação do segundo grau, também chamada de equação quadrática, é toda equação da forma:',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.fontSize(14).font('Courier').text('ax² + bx + c = 0', { align: 'center' });
  doc.font('Helvetica');
  doc.moveDown();

  doc.fontSize(11).text('Onde:');
  doc.fontSize(10).text('  • a, b e c são coeficientes (números reais)');
  doc.text('  • a ≠ 0 (se a = 0, a equação é do primeiro grau)');
  doc.text('  • x é a incógnita (variável)');
  doc.moveDown(1.5);

  doc.fontSize(14).text('2. Coeficientes', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).text('• Coeficiente a:', { bold: true });
  doc.fontSize(10).text('  É o coeficiente do termo quadrático (x²)');
  doc.moveDown(0.5);

  doc.fontSize(11).text('• Coeficiente b:', { bold: true });
  doc.fontSize(10).text('  É o coeficiente do termo linear (x)');
  doc.moveDown(0.5);

  doc.fontSize(11).text('• Coeficiente c:', { bold: true });
  doc.fontSize(10).text('  É o termo independente (constante)');
  doc.moveDown(1);

  doc.fontSize(10).text('Exemplo: Na equação 2x² - 5x + 3 = 0');
  doc.text('  a = 2, b = -5, c = 3');

  // Página 2
  doc.addPage();

  doc.fontSize(14).text('3. Fórmula de Bhaskara', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(
    'A fórmula de Bhaskara é utilizada para encontrar as raízes (soluções) de uma equação do segundo grau:',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.fontSize(14).font('Courier').text('x = (-b ± √Δ) / 2a', { align: 'center' });
  doc.font('Helvetica');
  doc.moveDown(1.5);

  doc.fontSize(14).text('4. Discriminante (Δ)', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(
    'O discriminante, representado pela letra grega Δ (delta), é calculado pela fórmula:',
    { align: 'justify' }
  );
  doc.moveDown();

  doc.fontSize(14).font('Courier').text('Δ = b² - 4ac', { align: 'center' });
  doc.font('Helvetica');
  doc.moveDown();

  doc.fontSize(11).text(
    'O valor de Δ determina a quantidade e o tipo de raízes que a equação possui.',
    { align: 'justify' }
  );

  // Página 3
  doc.addPage();

  doc.fontSize(14).text('5. Interpretação do Discriminante', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).text('Δ > 0 (delta positivo):', { bold: true });
  doc.fontSize(10).text('  A equação possui duas raízes reais e distintas (diferentes)');
  doc.moveDown();

  doc.fontSize(11).text('Δ = 0 (delta nulo):', { bold: true });
  doc.fontSize(10).text('  A equação possui duas raízes reais e iguais (uma raiz dupla)');
  doc.moveDown();

  doc.fontSize(11).text('Δ < 0 (delta negativo):', { bold: true });
  doc.fontSize(10).text('  A equação não possui raízes reais (possui raízes complexas)');
  doc.moveDown(1.5);

  doc.fontSize(14).text('6. Exemplos Resolvidos', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).text('Exemplo 1: x² - 5x + 6 = 0', { bold: true });
  doc.fontSize(10).text('  a = 1, b = -5, c = 6');
  doc.text('  Δ = (-5)² - 4(1)(6) = 25 - 24 = 1');
  doc.text('  Como Δ > 0, existem duas raízes reais distintas');
  doc.text('  x = (5 ± √1) / 2 = (5 ± 1) / 2');
  doc.text('  x₁ = 3 e x₂ = 2');
  doc.moveDown();

  doc.fontSize(11).text('Exemplo 2: x² - 4x + 4 = 0', { bold: true });
  doc.fontSize(10).text('  a = 1, b = -4, c = 4');
  doc.text('  Δ = (-4)² - 4(1)(4) = 16 - 16 = 0');
  doc.text('  Como Δ = 0, existe uma raiz real dupla');
  doc.text('  x = 4 / 2 = 2');

  doc.end();
  console.log('✅ sample_matematica.pdf criado (Equações 2º Grau, 3 páginas)');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('\n🚀 Iniciando geração de fixtures...\n');
  console.log('=' .repeat(60));
  console.log('\n');

  try {
    generateCSVs();
    generatePDFs();

    console.log('=' .repeat(60));
    console.log('\n✅ Geração concluída com sucesso!\n');
    console.log('Arquivos criados:');
    console.log('  • examples/csv/valido_minimo.csv');
    console.log('  • examples/csv/valido_completo.csv');
    console.log('  • examples/csv/invalido_campos.csv');
    console.log('  • examples/csv/invalido_dificuldade.csv');
    console.log('  • examples/pdf/sample_simples.pdf');
    console.log('  • examples/pdf/sample_matematica.pdf');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Erro ao gerar fixtures:', error);
    process.exit(1);
  }
}

main();
