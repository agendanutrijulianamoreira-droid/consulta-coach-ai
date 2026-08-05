# NutriOS — Fatia fina de ponta a ponta

Uma primeira versão funcional que cobre todo o caminho: iniciar consulta → transcrever → extrair dados → revisar etapas → gerar plano alimentar por motor de regras → prontuário editável.

## Observação sobre a stack

Este ambiente roda **TanStack Start (React + TypeScript + Tailwind + shadcn)** com **Lovable Cloud** (PostgreSQL/Supabase gerenciado, storage, jobs e IA integrada). Next.js e Prisma não são suportados aqui, mas todas as capacidades pedidas existem no equivalente nativo. Sem login nesta entrega — os dados ficam em um workspace único.

## O que será construído

### 1. Consulta ao vivo (`/consulta/$id`)
- Botão "Iniciar Consulta": começa gravação de áudio, transcrição e autosave.
- Cronômetro no topo: neutro → **amarelo** aos 5 min restantes de aviso (faltando 10 min) → **vermelho** faltando 5 min → aos 15 min dispara som discreto, toast e vibração no mobile. A gravação nunca é interrompida.
- Transcrição contínua: o áudio é capturado em janelas curtas (WAV) e transcrito; as falas aparecem em tempo real rotuladas como **Nutricionista** / **Paciente**.
- Offline: as janelas de áudio e o texto ficam em fila local (IndexedDB) e sincronizam quando a conexão volta.

### 2. Extração automática da anamnese
Enquanto a consulta corre, a IA lê a transcrição acumulada e preenche os campos: nome, idade, profissão, queixa principal, história, sintomas, medicamentos, suplementos, exames, doenças, alergias, intolerâncias, rotina, sono, estresse, exercício, água, evacuação, objetivos, motivação, preferências e restrições. Cada campo mostra a origem e pode ser **aceito, editado ou recusado**. Nada é gravado como definitivo sem revisão.

### 3. Etapas da consulta
- **Anamnese** — campos revisáveis + resumo clínico gerado ao concluir.
- **Antropometria** — peso, altura, IMC (calculado), circunferências, dobras, bioimpedância, gordura, massa muscular, água; leitura automática de evolução e risco.
- **Recordatório** — horário, alimentos, quantidade, preparo, observações; sinalização de excesso de açúcar, baixa proteína/fibras/água, ultraprocessados, poucos vegetais e padrões.
- **Diagnóstico** — apenas hipóteses sugeridas, sempre rotuladas como "sugestão para revisão profissional".
- **Conduta** — fase, meta calórica, macros, número de refeições, preferências, restrições, objetivos.

### 4. Base de alimentos e motor de regras
- Base inicial semeada com ~150 alimentos brasileiros (macros, porção padrão, medida caseira, grupo, índice glicêmico, custo, tempo de preparo, tags de restrição) + receitas de exemplo + tabela de substituições.
- Telas de CRUD e **importação por CSV** para você expandir a base com o seu método.
- **Motor determinístico** (TypeScript puro, sem IA): recebe kcal, macros, número de refeições, restrições e preferências; distribui as calorias entre café da manhã, lanche, almoço, lanche, jantar e ceia; seleciona apenas itens cadastrados; ajusta gramagens para bater as metas; monta substituições equivalentes. A IA **não escolhe alimentos nem quantidades** — apenas redige as justificativas e orientações a partir do plano já montado.
- Cada refeição exibe porção, gramas, medida caseira, macros, calorias e substituições.

### 5. Receitas e lista de compras
- Receitas derivadas dos itens da base: ingredientes, modo de preparo, tempo, rendimento e valor nutricional.
- Lista de compras gerada do plano, agrupada em hortifrúti, carnes, laticínios, mercearia, temperos, congelados e bebidas.

### 6. Prontuário
Ao finalizar, o sistema monta um documento único e **totalmente editável**: resumo clínico, anamnese, antropometria, recordatório, hipóteses, objetivos, conduta, plano alimentar, lista de compras, receitas, orientações, pendências, solicitação de exames e suplementação. Exportável em PDF.

### 7. Interface
Estilo Notion + Linear: fundo neutro, tipografia densa, quase sem cor (cor só para status), componentes compactos, tema claro e escuro, responsivo, autosave em todos os campos e atalhos de teclado (⌘K comandos, ⌘S salvar, ⌘↵ avançar etapa).

## Detalhes técnicos

- **Rotas**: `/` (lista de pacientes/consultas), `/pacientes/$id`, `/consulta/$id` (etapas), `/prontuario/$id`, `/alimentos`, `/receitas`, `/protocolos`.
- **Dados** (PostgreSQL via Lovable Cloud): `patients`, `consultations`, `transcript_segments`, `anamnesis`, `anthropometry`, `food_recall_items`, `diagnoses`, `conduct`, `meal_plans`, `meal_plan_items`, `foods`, `food_substitutions`, `recipes`, `recipe_ingredients`, `shopping_lists`, `records`, `ai_suggestions` (com estado aceito/editado/recusado). Migrations com GRANTs e RLS permissiva nesta fase (uso único), pronta para escopo por usuário depois.
- **Transcrição**: gravação PCM → WAV por janela, enviada a uma server function que chama o endpoint de speech-to-text (`openai/gpt-4o-transcribe`, streaming). Diarização Nutricionista/Paciente feita por passe de IA sobre a janela transcrita.
- **IA clínica**: `openai/gpt-5.6-sol` pela Responses API, em streaming, com schema estrito para extração de campos; toda saída entra como sugestão revisável, nunca como dado final.
- **Jobs**: filas leves em tabela (`jobs`) processadas por server functions para transcrição atrasada, resumo clínico e geração do plano, para não travar a UI.
- **Arquitetura**: módulos desacoplados em `src/modules/<consulta|transcricao|ia|prontuario|plano|receitas|compras|alimentos|protocolos|pacientes>`, cada um com `domain` (entidades e regras puras), `application` (casos de uso) e `infra` (acesso a dados). O motor de plano é domínio puro e testável, sem dependência de IA nem de banco.

## Fora desta primeira entrega

Login e multiusuário, relatórios agregados, protocolos avançados, integrações externas e app mobile nativo — todos previstos na estrutura, adicionados depois.
