# 🔄 Ankinator MCP - Extração Iterativa de Questões

## ✅ Problema Resolvido

O ankinator-mcp foi refatorado para **NÃO** usar ANTHROPIC_API_KEY internamente. Agora ele funciona como **sequential-thinking** e **memory**: apenas estrutura dados e retorna para Claude processar.

## 🎯 Nova Ferramenta: `extrair_questoes_iterativo`

### Características

- ✅ **Sem API key** - não requer ANTHROPIC_API_KEY
- 🔄 **Loop automático** - processa chunks iterativamente
- 📊 **Sistema de progresso** - mostra chunk atual, total, percentual
- 🎛️ **Configurável** - define quantos chunks processar por iteração
- 🔁 **Retomável** - pode retomar de qualquer chunk usando `start_chunk`
- 📝 **Prompt contextualizado** - cada chunk já vem com instrução de extração

### Como Usar

#### 1. Via MCP (recomendado)

```bash
# Reconecte ao MCP ankinator
/mcp
```

Depois chame a ferramenta:

```json
{
  "name": "extrair_questoes_iterativo",
  "arguments": {
    "path": "/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf",
    "chunk_size": 5,
    "overlap": 2,
    "start_chunk": 0,
    "max_chunks": 90,
    "chunk_batch_size": 3
  }
}
```

#### 2. Via Script Node.js

```bash
node /home/t316360/plottwist/ankinator/test-iterativo.js
```

## 📋 Parâmetros

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `path` | string | - | Caminho do arquivo PDF |
| `chunk_size` | number | 5 | Número de páginas por chunk |
| `overlap` | number | 2 | Overlap entre chunks (evita perda de questões) |
| `start_chunk` | number | 0 | Chunk inicial (para retomar) |
| `max_chunks` | number | 90 | Máximo de chunks a processar |
| `chunk_batch_size` | number | 1 | Quantos chunks retornar por iteração |

## 📤 Output

Para cada iteração, retorna:

```json
{
  "iteration": 1,
  "chunks_batch": [
    {
      "chunk_index": 0,
      "page_start": 1,
      "page_end": 5,
      "texto": "...",
      "num_chars": 6367,
      "prompt_contexto": "Instruções + texto do chunk"
    }
  ],
  "progress": {
    "chunk_atual": 3,
    "total_chunks": 90,
    "percentual": 3,
    "chunks_restantes": 87
  },
  "metadata": {
    "total_pages": 270,
    "total_chars": 339843,
    "chunk_size_usado": 5,
    "overlap_usado": 2
  },
  "has_more": true,
  "next_start_chunk": 3
}
```

## 🔄 Fluxo de Trabalho Iterativo

### Exemplo de uso com Claude:

**Iteração 1:**
```
📊 Progresso: 3/90 chunks (3%)
📦 Chunks: 3
⏭️  Restantes: 87

Processando chunks 0, 1, 2...
[Claude extrai/cria questões aqui]

🔁 Próxima iteração: start_chunk=3
```

**Iteração 2:**
```
📊 Progresso: 6/90 chunks (7%)
📦 Chunks: 3
⏭️  Restantes: 84

Processando chunks 3, 4, 5...
[Claude extrai/cria questões aqui]

🔁 Próxima iteração: start_chunk=6
```

... continua até `has_more=false`

## 🎨 Formato de Questões

O prompt contextualizado instrui Claude a:

### 1. EXTRAIR questões existentes
```
[EXTRAÍDA]
Q: (FGV - 2021) Qual a definição de projeto segundo PMBOK?
A: Esforço temporário para criar produto/serviço único
```

### 2. CRIAR novas questões
```
[CRIADA]
Q: Quais são as 10 áreas de conhecimento do PMBOK 6?
A: Integração, Escopo, Cronograma, Custos, Qualidade, Recursos, Comunicações, Riscos, Aquisições, Partes Interessadas
```

## 💡 Dicas

### Para processar TODO o PDF:

1. **Batch grande** (mais questões por chamada, menos iterações):
```json
{
  "chunk_batch_size": 10  // 10 chunks por iteração = ~9 iterações
}
```

2. **Batch pequeno** (mais controle, mais iterações):
```json
{
  "chunk_batch_size": 1  // 1 chunk por iteração = 90 iterações
}
```

### Para focar em seção específica:

Se questões começam na página 186 (chunk 61):
```json
{
  "start_chunk": 61,
  "chunk_batch_size": 5  // Processa 5 chunks da seção de questões
}
```

### Para retomar processamento interrompido:

Se parou no chunk 45:
```json
{
  "start_chunk": 45
}
```

## 🔧 Arquitetura

```
┌─────────────────────────────────────────┐
│  Ankinator MCP Server                   │
│  (SEM ANTHROPIC_API_KEY)                │
│                                         │
│  1. Lê PDF                              │
│  2. Divide em chunks com overlap        │
│  3. Retorna batch de chunks             │
│  4. Inclui prompt contextualizado       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Claude na Conversa                     │
│  (processa conteúdo)                    │
│                                         │
│  1. Recebe chunks + prompt              │
│  2. EXTRAI questões existentes          │
│  3. CRIA novas questões                 │
│  4. Retorna questões formatadas         │
│  5. Solicita próxima iteração           │
└─────────────────────────────────────────┘
```

## 📊 Exemplo de Saída Completa

Após processar TODAS as 90 iterações:

```
✅ RESUMO FINAL
================================================================================
Total de iterações: 30 (com batch_size=3)
Total de questões: 350

Breakdown:
- [EXTRAÍDA]: 180 questões (do PDF original)
- [CRIADA]: 170 questões (baseadas nos conceitos)

💾 Questões salvas em: questoes-extraidas.json
```

## 🚀 Próximos Passos

1. **Processar PDF completo** usando a ferramenta iterativa
2. **Exportar para CSV** usando `converter_para_csv`
3. **Validar CSV** usando `validar_csv`
4. **Importar no Anki** usando o addon ankimon

## 📝 Notas

- Cada chunk tem ~6.3k caracteres
- Overlap de 2 páginas garante que questões não sejam cortadas
- Sistema adaptativo ajusta chunk_size baseado no tamanho do PDF
- Chunks são processados sequencialmente para manter contexto
