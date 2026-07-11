# BarberPilot App

## Production billing changes — approval gate

Standing rule, full text in `barberpilot-api/CLAUDE.md`. Applies to this repo too: any change
touching prices, commission splits, staff roles/permissions, or EAS OTA publishes needs a
separate, explicit go-ahead after verification is reported — never bundled with the
verification request itself.

## G Stack Skills (gstack by Garry Tan)

Instalado en `~/.claude/skills/gstack`. Las herramientas disponibles como slash commands son:

### Código y calidad
| Comando | Descripción |
|---|---|
| `/review` | Code review completo del branch actual |
| `/qa` | QA automatizado: tests, lint, verificación de flujos |
| `/qa-only` | Solo ejecuta QA sin otras acciones |
| `/health` | Diagnóstico del estado del proyecto |
| `/investigate` | Investigación profunda de un bug o problema |
| `/canary` | Despliega cambio mínimo para validar antes de ship |
| `/careful` | Ejecuta cualquier tarea con modo extra-cuidadoso |

### Planificación
| Comando | Descripción |
|---|---|
| `/autoplan` | Genera un plan de implementación antes de cualquier tarea |
| `/plan-eng-review` | Plan + review de ingeniería |
| `/plan-design-review` | Plan + review de diseño |
| `/plan-devex-review` | Plan + review de DX/developer experience |
| `/plan-ceo-review` | Plan + revisión ejecutiva |
| `/plan-tune` | Ajusta y refina un plan existente |

### Ship / Deploy
| Comando | Descripción |
|---|---|
| `/ship` | Flujo completo: review → QA → merge → deploy |
| `/land-and-deploy` | Hace merge y despliega |
| `/freeze` | Congela el branch (bloquea cambios) |
| `/unfreeze` | Descongela el branch |
| `/guard` | Protege un branch de merges accidentales |

### Diseño
| Comando | Descripción |
|---|---|
| `/design` | Flujo de diseño asistido |
| `/design-review` | Review de decisiones de diseño |
| `/design-html` | Genera HTML/CSS a partir de un diseño |
| `/design-consultation` | Consulta de diseño interactiva |
| `/design-shotgun` | Genera múltiples variantes de diseño |

### Browser / Scraping
| Comando | Descripción |
|---|---|
| `/browse` | Navega y controla el browser desde Claude |
| `/scrape` | Extrae datos de una URL |
| `/open-gstack-browser` | Abre el browser integrado de gstack |
| `/setup-browser-cookies` | Configura cookies del browser |

### Documentación
| Comando | Descripción |
|---|---|
| `/document-generate` | Genera documentación del código |
| `/document-release` | Genera release notes |
| `/landing-report` | Informe de landing/onboarding |
| `/learn` | Modo de aprendizaje guiado |
| `/retro` | Retrospectiva del sprint/release |

### Agentes y sesiones
| Comando | Descripción |
|---|---|
| `/pair-agent` | Modo pair programming con un agente secundario |
| `/context-save` | Guarda el contexto de la sesión actual |
| `/context-restore` | Restaura un contexto guardado |
| `/codex` | Integración con OpenAI Codex |
| `/benchmark` | Benchmarks de calidad de código |
| `/benchmark-models` | Compara modelos en una tarea |

### iOS
| Comando | Descripción |
|---|---|
| `/ios-fix` | Fix específico para proyectos iOS |
| `/ios-qa` | QA para iOS |
| `/ios-design-review` | Design review para iOS |
| `/ios-clean` | Limpia build artifacts de iOS |
| `/ios-sync` | Sincroniza dependencias iOS |

### Utilidades
| Comando | Descripción |
|---|---|
| `/gstack` | Info y estado de gstack |
| `/gstack-upgrade` | Actualiza gstack a la última versión |
| `/skillify` | Convierte una tarea en un skill reutilizable |
| `/make-pdf` | Genera PDF desde markdown |
| `/cso` | Chief Strategy Officer mode |
| `/office-hours` | Sesión de consultas estructurada |
| `/setup-deploy` | Configura pipeline de deploy |
| `/setup-gbrain` | Configura integración con GBrain |
| `/sync-gbrain` | Sincroniza con GBrain |
| `/devex-review` | Review de developer experience |

> Para actualizar gstack: `/gstack-upgrade`
> Repo: `~/.claude/skills/gstack` — re-correr `./setup` después de cada `git pull`
