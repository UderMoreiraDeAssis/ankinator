# 🔍 Revisão do Ankinator MCP - Best Practices

## 📋 Análise Comparativa

Baseado nos exemplos de servers MCP oficiais (`sequential-thinking`, `memory`) e documentação do TypeScript SDK.

---

## ❌ Problemas Identificados

### 1. **Falta de `structuredContent` em TODAS as respostas**

**Problema:**
```typescript
// ankinator-mcp/src/index.ts - ATUAL ❌
return {
  content: [
    {
      type: 'text' as const,
      text: mensagem,
    },
  ],
  structuredContent: output,  // ✅ TEM em algumas ferramentas
};

// MAS em várias ferramentas falta:
return {
  content: [
    {
      type: 'text' as const,
      text: truncateText(resumo + detalhes, 2000),
    },
  ],
  // ❌ FALTA structuredContent
};
```

**Best Practice:**
```typescript
// memory/index.ts - CORRETO ✅
return {
  content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  structuredContent: { entities: result }  // ✅ SEMPRE presente
};
```

---

### 2. **Schema Definition Incorreta**

**Problema:**
```typescript
// ankinator-mcp/src/index.ts - ATUAL ❌
server.registerTool(
  'listar_docs',
  {
    title: 'Listar documentos do projeto',
    description: '...',
    inputSchema: listarDocsInput,      // ❌ Schema Zod direto
    outputSchema: listarDocsOutput,
  } as any,  // ❌ Usa 'as any'
  async (_args?: unknown) => {  // ❌ Tipo genérico
```

**Best Practice:**
```typescript
// memory/index.ts - CORRETO ✅
server.registerTool(
  "create_entities",
  {
    title: "Create Entities",
    description: "Create multiple new entities in the knowledge graph",
    inputSchema: {
      entities: z.array(EntitySchema)  // ✅ Schema object inline
    },
    outputSchema: {
      entities: z.array(EntitySchema)
    }
  },
  async ({ entities }) => {  // ✅ Destructuring tipado
```

---

### 3. **Falta de Error Handling com `isError`**

**Problema:**
```typescript
// ankinator-mcp/src/index.ts - ATUAL ❌
if (!anthropicClient) {
  throw new Error('ANTHROPIC_API_KEY não configurada...');
  // ❌ Lança exceção em vez de retornar isError
}
```

**Best Practice:**
```typescript
// sequential-thinking/lib.ts - CORRETO ✅
if (result.isError) {
  return result;  // ✅ Retorna com isError: true
}

// sqlite example - CORRETO ✅
catch (err: unknown) {
  const error = err as Error;
  return {
    content: [{ type: 'text', text: `Error: ${error.message}` }],
    isError: true  // ✅ Flag de erro
  };
}
```

---

### 4. **Falta de Separação de Lógica (Manager Classes)**

**Problema:**
```typescript
// ankinator-mcp/src/index.ts - ATUAL ❌
// Toda lógica dentro dos handlers
server.registerTool(..., async (args) => {
  // Lógica de extração PDF aqui
  const dataBuffer = await fs.readFile(resolved);
  const parser = new PDFParse({ data: dataBuffer });
  // ... 50 linhas de lógica
});
```

**Best Practice:**
```typescript
// memory/index.ts - CORRETO ✅
export class KnowledgeGraphManager {
  constructor(private memoryFilePath: string) {}

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    // Lógica isolada
  }
}

let knowledgeGraphManager: KnowledgeGraphManager;

server.registerTool(..., async ({ entities }) => {
  const result = await knowledgeGraphManager.createEntities(entities);
  // Handler apenas orquestra
});
```

---

### 5. **Console.error para Logging vs Mensagens de Usuário**

**Problema:**
```typescript
// ankinator-mcp/src/index.ts - ATUAL ❌
console.error(`[Chunking] Total de ${chunks.length} chunks...`);
// ❌ Mistura logs de debug com output
```

**Best Practice:**
```typescript
// memory/index.ts - CORRETO ✅
console.error("Knowledge Graph MCP Server running on stdio");
// ✅ Apenas logs de sistema/debug
// Mensagens para usuário vão no content/structuredContent
```

---

### 6. **Uso de `type: 'text' as const`**

**Status:** ✅ **CORRETO** - ankinator já usa isso corretamente

---

### 7. **Startup Sequence e Initialization**

**Problema:**
```typescript
// ankinator-mcp/src/index.ts - ATUAL ❌
const start = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

void start().catch((error) => {
  console.error('Erro ao iniciar MCP server:', error);
  process.exit(1);
});
// ❌ Sem mensagem de confirmação
```

**Best Practice:**
```typescript
// memory/index.ts - CORRETO ✅
async function main() {
  // Initialize components
  MEMORY_FILE_PATH = await ensureMemoryFilePath();
  knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

---

## ✅ Melhorias Recomendadas

### 1. **Criar PdfManager Class**

```typescript
// Novo arquivo: ankinator-mcp/src/pdf-manager.ts
export class PdfManager {
  async extractText(pdfPath: string): Promise<string> {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await PDFParse(dataBuffer);
    return data.text;
  }

  async extractWithMetadata(pdfPath: string): Promise<{ text: string; numPages: number }> {
    const dataBuffer = await fs.readFile(pdfPath);
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    await parser.destroy();

    return {
      text: textResult.text,
      numPages: infoResult.total || 1,
    };
  }

  createChunks(pages: string[], chunkSize: number, overlap: number): PdfChunk[] {
    // Lógica de chunking isolada
  }
}
```

### 2. **Atualizar Tool Handlers para Usar Manager**

```typescript
// ankinator-mcp/src/index.ts
import { PdfManager } from './pdf-manager.js';

const pdfManager = new PdfManager();

server.registerTool(
  'extrair_texto_pdf',
  {
    title: 'Extrair texto de PDF (sem API key)',
    description: '...',
    inputSchema: {
      path: z.string(),
      maxChars: z.number().int().positive().max(100000).default(50000),
      incluir_prompt: z.boolean().default(true)
    },
    outputSchema: {
      texto: z.string(),
      num_chars: z.number(),
      num_pages: z.number(),
      prompt_extracao: z.string().optional(),
      truncado: z.boolean()
    }
  },
  async ({ path: userPath, maxChars = 50000, incluir_prompt = true }) => {
    try {
      const { resolved } = resolveWithinAllowed(userPath);
      const { text: pdfText, numPages } = await pdfManager.extractWithMetadata(resolved);

      if (!pdfText || pdfText.trim().length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'PDF não contém texto extraível.' }],
          isError: true
        };
      }

      const truncado: boolean = pdfText.length > maxChars;
      const textoFinal = truncado
        ? pdfText.substring(0, maxChars) + '\n\n[... truncado]'
        : pdfText;

      const output = {
        texto: textoFinal,
        num_chars: textoFinal.length,
        num_pages: numPages,
        prompt_extracao: incluir_prompt ? EXTRACTION_PROMPT : undefined,
        truncado: truncado,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output  // ✅ SEMPRE presente
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Erro: ${(error as Error).message}` }],
        isError: true  // ✅ Error handling
      };
    }
  }
);
```

### 3. **Adicionar structuredContent em TODAS as ferramentas**

Verificar cada `registerTool` e garantir que SEMPRE retorna `structuredContent`.

### 4. **Remover `as any` dos type assertions**

```typescript
// ANTES ❌
server.registerTool(
  'listar_docs',
  {
    title: '...',
    inputSchema: listarDocsInput,
    outputSchema: listarDocsOutput,
  } as any,

// DEPOIS ✅
server.registerTool(
  'listar_docs',
  {
    title: '...',
    inputSchema: {
      // schema inline
    },
    outputSchema: {
      // schema inline
    }
  },
```

### 5. **Melhorar Error Messages**

```typescript
// ANTES ❌
throw new Error('Path fora da zona permitida...');

// DEPOIS ✅
return {
  content: [{
    type: 'text' as const,
    text: `Error: Path fora da zona permitida. Use caminhos sob: ${allowedList}`
  }],
  isError: true,
  structuredContent: {
    error: 'INVALID_PATH',
    message: `Path fora da zona permitida`,
    allowedPaths: ALLOWED_ROOTS
  }
};
```

---

## 📊 Checklist de Implementação

### High Priority

- [ ] **Adicionar `structuredContent` em TODAS as ferramentas**
- [ ] **Criar `PdfManager` class** para separar lógica
- [ ] **Converter `throw Error` para `isError: true`**
- [ ] **Remover `as any` type assertions**

### Medium Priority

- [ ] **Converter schemas para inline objects**
- [ ] **Adicionar mensagem de startup** (console.error)
- [ ] **Melhorar error messages** com `structuredContent`

### Low Priority

- [ ] **Adicionar JSDoc** para funções públicas
- [ ] **Criar testes unitários** para PdfManager
- [ ] **Adicionar validation** para path traversal

---

## 🎯 Exemplo de Refatoração Completa

### Antes (❌):

```typescript
server.registerTool(
  'validar_csv',
  {
    title: 'Validar arquivo CSV',
    description: '...',
    inputSchema: validarCsvInput,
    outputSchema: validarCsvOutput,
  } as any,
  async (args: any) => {
    const { path: userPath, maxRows = 200 } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const content = await fs.readFile(resolved, 'utf8');
    // ... lógica ...
    return {
      content: [{ type: 'text' as const, text: truncateText(resumo + detalhes, 2000) }],
      structuredContent: output
    };
  }
);
```

### Depois (✅):

```typescript
export class CsvManager {
  async validate(filePath: string, maxRows: number): Promise<ValidationResult> {
    const content = await fs.readFile(filePath, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const linhasProcessar = records.slice(0, maxRows);
    const erros: Array<{ linha: number; mensagem: string }> = [];
    let validas = 0;

    linhasProcessar.forEach((row: any, index: number) => {
      const result = csvRowSchema.safeParse(row);
      if (!result.success) {
        const mensagens = result.error.issues
          .map((err: any) => `${err.path.join('.')}: ${err.message}`)
          .join('; ');
        erros.push({ linha: index + 2, mensagem: mensagens });
      } else {
        validas += 1;
      }
    });

    return {
      totalLinhas: linhasProcessar.length,
      validas,
      invalidas: erros.length,
      erros: erros.slice(0, 50),
    };
  }
}

const csvManager = new CsvManager();

server.registerTool(
  'validar_csv',
  {
    title: 'Validar arquivo CSV',
    description: 'Valida formato de perguntas em CSV usando schema Zod.',
    inputSchema: {
      path: z.string().describe('Caminho do arquivo CSV a validar'),
      maxRows: z.number().int().positive().max(1000).default(200)
    },
    outputSchema: {
      totalLinhas: z.number(),
      validas: z.number(),
      invalidas: z.number(),
      erros: z.array(z.object({
        linha: z.number(),
        mensagem: z.string(),
      }))
    }
  },
  async ({ path: userPath, maxRows = 200 }) => {
    try {
      const { resolved } = resolveWithinAllowed(userPath);
      const output = await csvManager.validate(resolved, maxRows);

      const resumo = `Total: ${output.totalLinhas} linhas | Válidas: ${output.validas} | Inválidas: ${output.invalidas}`;
      const detalhes = output.erros.length > 0
        ? '\n\nErros encontrados:\n' + output.erros.slice(0, 20)
            .map(e => `Linha ${e.linha}: ${e.mensagem}`).join('\n')
        : '\n\nTodas as linhas estão válidas!';

      return {
        content: [{ type: 'text' as const, text: resumo + detalhes }],
        structuredContent: output
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Erro: ${(error as Error).message}` }],
        isError: true,
        structuredContent: {
          error: 'VALIDATION_FAILED',
          message: (error as Error).message
        }
      };
    }
  }
);
```

---

## 🚀 Próximos Passos

1. ✅ **Criar managers** (PdfManager, CsvManager)
2. ✅ **Refatorar tools** um por um
3. ✅ **Adicionar error handling** com isError
4. ✅ **Testar** cada ferramenta refatorada
5. ✅ **Documentar** mudanças no README

---

## 📚 Referências

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Sequential Thinking Server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)
- [Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [MCP Best Practices](https://context7.com/modelcontextprotocol/typescript-sdk)
