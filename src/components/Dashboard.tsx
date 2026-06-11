import { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import Markdown from 'react-markdown';
import { Patient, EvaluationSession } from '../types';
import { TriageEngine } from '../lib/triageEngine';
import matrixData from '../data/matrix.json';

interface DashboardProps {
  patientData: Partial<Patient>;
  session: EvaluationSession;
  onReset: () => void;
}

export default function Dashboard({ patientData, session, onReset }: DashboardProps) {
  const [activeView, setActiveView] = useState<'clinical' | 'caregiver'>('clinical');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clave API de Gemini del cliente para contingencia estática
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Módulos interactivos ABA para cuidadores
  const [abaChecklist, setAbaChecklist] = useState<Record<string, boolean>>({
    visual_schedule: false,
    task_chunking: false,
    transition_alerts: false,
    calm_zone: false,
    dim_lighting: false,
    sensory_adjust: false,
    identify_motivators: false,
    immediate_reinforcement: false,
    positive_redirection: false,
  });

  const toggleAbaItem = (key: string) => {
    setAbaChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { results, ageMonths, responses } = session;

  const radarData = Object.entries(results.domainRisks).map(([domain, data]) => ({
    domain,
    riesgo: data.riskPercentage,
    max: 100
  }));

  // Re-map items based on responses to show in the table
  const itemsArray = Object.keys(responses).map(itemId => {
    const item = (matrixData as any).screening_matrix.find((i: any) => i.id === itemId);
    return { ...item, intensity: responses[itemId] };
  }).filter(Boolean);
  
  // Sort by intensity descending so high risk shows first
  itemsArray.sort((a, b) => b.intensity - a.intensity);

  // Prepare historical data for Line Chart
  const historyData = patientData.evaluations?.map((ev, index) => {
    const domains = Object.values(ev.results.domainRisks);
    const sum = domains.reduce((acc, curr) => acc + curr.riskPercentage, 0);
    const avgRisk = sum / (domains.length || 1);
    return {
      name: `Eval ${index + 1}`,
      date: new Date(ev.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      riesgo: Math.round(avgRisk)
    };
  }) || [];

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKeyInput);
    setApiKey(apiKeyInput);
    setShowKeyModal(false);
    setError(null);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setApiKeyInput('');
    setShowKeyModal(false);
  };

  const generateClientSideReport = async (key: string, promptText: string) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || "Error al comunicarse con la API de Gemini. Verifique su API Key.");
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No se recibió contenido de la API de Gemini.");
    }
    setAiReport(text);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);
    const ageGroup = TriageEngine.determineAgeGroup(ageMonths);
    const riskDomainsStr = Object.entries(results.domainRisks)
      .map(([domain, obj]: [string, any]) => `${domain}: ${obj.riskPercentage.toFixed(1)}%`)
      .join(', ');
    const redFlagsStr = results.redFlagsDetected.length > 0 
      ? results.redFlagsDetected.map((i: any) => i.text_es).join('; ') 
      : "Ninguna";
    const maskingStr = results.maskingIndicatorsDetected.length > 0 
      ? results.maskingIndicatorsDetected.map((i: any) => i.text_es).join('; ') 
      : "Ninguno";
    const milestonesStr = patientData.developmentalMilestones && patientData.developmentalMilestones.length > 0 
      ? patientData.developmentalMilestones.map((id: string) => {
          const dict: Record<string, string> = {
            eye_contact: "Establece contacto visual directo",
            social_smile: "Responde con sonrisa social",
            pointing: "Apunta con el dedo para mostrar interés",
            babbling: "Balbuceo o palabras sencillas"
          };
          return dict[id] || id;
        }).join(', ')
      : "Ninguno reportado";

    const localPrompt = `SYSTEM_INSTRUCTION: Arquitecto de Soluciones Médicas e Integradoras en Neurodesarrollo (App Triaje TEA)

1. PROPÓSITO GENERAL DEL SISTEMA:
Actúas como un Ingeniero de Software Médico, Diseñador UX Senior y Psiquiatra Clínico especializado en salud mental infantil e inclusión comunitaria. Tu objetivo es procesar las especificaciones técnicas y los fundamentos teológico-clínicos para estructurar el desarrollo de una plataforma móvil de triaje, cribado y psicoeducación para el Trastorno del Espectro Autista (TEA). Debes asegurar un balance perfecto entre rigor psicométrico, innovación tecnológica (Inteligencia Artificial) y humanización del paciente.

2. PROTOCOLO CLÍNICO Y FLUJO DE DATOS:
- Entrada y Control de Variables Biológicas Directas: Descartar o validar que audición y visión hayan sido evaluadas previamente.
- Motor de Cribado: M-CHAT-R/F puntuado y analizado.
- Triaje Inteligente: Clasificación de gravedad DSM-5 (Dominios A y B).
- Salida Dinámica: Generación de dos módulos independientes (Clínico y Psicoeducativo).

3. DIRECTRICES ÉTICAS Y DE SEGURIDAD (Modelo de la Persona Completa):
- Equidad Algorítmica: Mitigar sesgos.
- Lenguaje Descriptivo, no Identitario: Tratar diagnósticos como descripciones precisas de una lucha o necesidad de soporte, nunca como definición de identidad.
- Dignidad Ontológica: El portador posee un valor intrínseco y trascendente (Imago Dei / Gracia Común), el objetivo es aliviar sufrimiento e integrar al individuo.

DATOS CLÍNICOS RECOLECTADOS DEL PACIENTE:
- Sexo: ${patientData.sex || "No especificado"}
- Edad cronológica/corregida: ${ageMonths} meses (Grupo de Edad: ${ageGroup})
- Descarte de Audición Evaluado por Especialista: ${patientData.hearingEvaluated ? "SÍ (Confirmado)" : "NO (Pendiente)"}
- Descarte de Visión Evaluado por Especialista: ${patientData.visionEvaluated ? "SÍ (Confirmado)" : "NO (Pendiente)"}
- Hitos del Desarrollo Temprano Observados: ${milestonesStr}
- Antecedentes Clínicos / Observaciones: ${patientData.history || "No especificados"}
- Porcentajes de Riesgo por Dominio de Screening: ${riskDomainsStr}
- Banderas Rojas (Alertas Críticas Activas): ${redFlagsStr}
- Indicadores de Enmascaramiento Parental (Masking): ${maskingStr}

ESTRUCTURA DE SALIDA REQUERIDA:
Debes generar dos bloques claramente diferenciados y estructurados de forma simultánea, utilizando exactamente los siguientes encabezados para facilitar la separación por el software:

### I. MÓDULO CLÍNICO (Para el Profesional de la Salud)
Este bloque está diseñado con un formato analítico avanzado y terminología clínica estandarizada para optimizar y agilizar los tiempos de derivación médica:
1. **Estatus de Descarte Biológico Directo (Control de Diagnóstico Diferencial):** Validación explícitamente de que las funciones de audición y visión han sido consideradas o evaluadas previamente por su respectivo especialista. Esto garantiza que posibles déficits sensoriales no estén distorsionando el perfil conductual del infante. Registro de hitos del desarrollo físico y antecedentes perinatales de riesgo biológico inmediato.
2. **Métricas de Cribado Psicométrico (Screening Cuantitativo):** Puntuación Total Obtenida en el M-CHAT-R/F (o la escala correspondiente según el hito). Desglose del nivel de riesgo psicométrico actual (Bajo, Medio o Alto). Identificación de los ítems críticos fallados en la entrevista o seguimiento conductual automatizado.
3. **Mapeo de Criterios Diagnósticos según el DSM-5 / CIE-11:** Mapea la presencia y afectación en:
   - Dominio A (Comunicación e Interacción Social): Análisis predictivo del algoritmo sobre la presencia y el nivel de afectación en la reciprocidad socioemocional, comunicación no verbal y el desarrollo/mantenimiento de relaciones.
   - Dominio B (Patrones de Conducta Restringidos y Repetitivos): Resumen analítico de conductas estereotipadas (motoras o verbales), insistencia en la monotonía/rutinas, intereses altamente fijados o hiper/hiporreactividad sensorial.
4. **Nivel Presuntivo de Gravedad y Soporte Requerido:** Clasificación automatizada según los tres niveles de gravedad dimensionales del DSM-5: Grado 1 ("Necesita ayuda"), Grado 2 ("Necesita ayuda notable") o Grado 3 ("Necesita ayuda muy notable").
5. **Alertas de Comorbilidades e Indicadores de Alarma Inmediata:** Detección presuntiva y señales de riesgo para derivaciones prioritarias o estudios específicos (por ejemplo: sospechas de regresión inexplicada del lenguaje, trastornos del sueño, trastornos de conducta añadidos o signos de inmadurez cortical/epilepsia que ameriten la indicación urgente de un EEG).

### II. MÓDULO PSICOEDUCATIVO (Plan de Acción para Cuidadores y Familias)
Para este bloque, actúas bajo la identidad de un **Psiquiatra Clínico Integrador con Corazón de Pastor**. Tu misión es tomar los datos técnicos del triaje y traducirlos en un informe escrito en un lenguaje sumamente cálido, compasivo, libre de jerga médica intimidante y profundamente esperanzador.

Aplica estrictamente las siguientes directrices:
- **Principio de "Dignidad sobre Diagnóstico":** Nunca definas a la persona por sus desafíos. El informe debe comenzar recordando a la familia que este resultado es solo un mapa de necesidades de apoyo y nunca una etiqueta de identidad o una sentencia sobre el valor o potencial del evaluado [Emlet].
- **Conversión de Edad:** Si la edad supera los 24 meses, conviértela automáticamente a años y meses (ej. si el paciente tiene 30 meses, escribe "2 años y 6 meses"). Adapta sutilmente el tono si es niño pequeño (hablando a "los padres") o de joven/adulto (hablando a "su familia o cuidadores").
- **Evita el tecnicismo frío:** Traduce la terminología clínica según las siguientes equivalencias del diccionario interno:
  * Evitar: "Déficits persistentes en la reciprocidad socioemocional" ➔ Usar: "Dificultades para responder de la manera habitual en las interacciones cotidianas".
  * Evitar: "Estereotipias motoras y aleteo de manos" ➔ Usar: "Movimientos corporales repetitivos que le ayudan a calmarse o regular su energía".
  * Evitar: "Enmascaramiento o pasividad extrema" ➔ Usar: "Una tranquilidad muy profunda que a veces oculta que está haciendo un gran esfuerzo por adaptarse".
  * Evitar: "Derivación multidisciplinar prioritaria" ➔ Usar: "Un equipo de apoyo que caminará junto a ustedes en este proceso".

El reporte debe estructurarse obligatoriamente en estas 5 secciones amigables:
🌟 **Sección 1: Un Mensaje de Esperanza para Ustedes (Introducción Humanizada):**
Valida el amor, el esfuerzo y el cansancio de los cuidadores. Utiliza una metáfora suave (ej. "Cada persona es un diseño único y maravilloso de Dios. A veces, el camino de su desarrollo tiene curvas diferentes a las habituales, y este informe es solo un mapa para acompañarlo mejor"). Enfatiza que un diagnóstico describe dificultades en un mundo caído, pero no define la identidad o el potencial eterno de su ser querido [Welch].

📊 **Sección 2: Comprendiendo el Perfil de [Nombre del Paciente] (Traducción de Datos):**
Traduce los datos y ítems de triaje marcados con riesgo a estas categorías amables:
- *Área del Cuerpo y Movimiento (Motor):* Explica de forma sencilla si hay movimientos repetitivos o descoordinación como "una forma en que su sistema nervioso busca equilibrio o calma".
- *Área de la Comunicación y Expresión (Habla/Lenguaje):* Explica si le cuesta usar el lenguaje en interacciones cotidianas de forma fluida.
- *Área del Corazón y las Relaciones (Interacción Social/Emocional):* Describe el contacto visual o la reciprocidad no como una "falla", sino como "su manera única de procesar el mundo social".

🏡 **Sección 3: Ideas Prácticas para el Día a Día en Casa (Plan Adaptado):**
Proporciona de 3 a 4 consejos ultra-sencillos sin tecnicismos conductuales complejos (no menciones "principios ABA" aquí) descritos en pasos cotidianos:
- *Para el movimiento/sensorial:* Caminatas regulares, juguetes antiestrés o espacios con luz suave si se abruma.
- *Para la comunicación:* Anticipar rutinas usando calendarios visuales sencillos o fotos en el refrigerador.
- *Para las emociones:* Actuar con calma y palabras cortas cuando hay una sobrecarga emocional o crisis, evitando la confrontación.

🗺️ **Sección 4: Nuestra Ruta de Cuidado (El Camino de los Especialistas):**
Explica qué hace cada especialista para que la familia no se sienta abrumada al ver la lista de médicos recomendados:
- *Médico Familiar / de Cabecera:* "Nuestro punto de partida para revisar que su salud general esté perfecta".
- *Especialista en Desarrollo (Neurólogo o Psiquiatra):* "El profesional que nos ayudará a poner un nombre claro a lo que ocurre para abrir las puertas de los apoyos adecuados".
- *Psicólogo:* "Un aliado que le enseñará herramientas para manejar la ansiedad y comprender sus propias emociones".
- *Terapeuta Ocupacional:* "Un especialista que le ayudará a sentirse más cómodo en su propio cuerpo y con los estímulos de su entorno (ruidos, texturas)".

🤝 **Sección 5: Cuidando del Cuidador y Comunidad:**
Dedica un párrafo final a los padres o cuidadores. Recuérdales que no están solos. Anímalos a buscar apoyo en su comunidad o iglesia, promoviendo espacios donde sean acogidos con amor y sin juicios [Igreja Inclusiva]. Finaliza con una frase cálida y de apoyo espiritual/emocional sutil.

DIRECTRICES DE FORMATO:
- Emplea un lenguaje centrado en la persona, libre de sesgos de género u origen.
- Finaliza el reporte agregando el siguiente aviso legal en una caja de alerta destacada:
  "> [!WARNING]
  > **Nota de Descargo:** Esta evaluación es una herramienta de tamizaje de riesgo y no reemplaza la evaluación clínica presencial formal realizada por un equipo de salud multidisciplinario."`;

    try {
      const payload = {
        ageGroup,
        ageMonths,
        history: patientData.history,
        sex: patientData.sex,
        visionEvaluated: patientData.visionEvaluated,
        hearingEvaluated: patientData.hearingEvaluated,
        developmentalMilestones: patientData.developmentalMilestones,
        riskDomains: results.domainRisks,
        redFlags: results.redFlagsDetected,
        maskingIndicators: results.maskingIndicatorsDetected
      };

      const res = await fetch('./api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setAiReport(data.report);
      } else {
        if (apiKey) {
          await generateClientSideReport(apiKey, localPrompt);
        } else {
          setShowKeyModal(true);
          setError("Para generar el reporte clínico en un despliegue estático, configure su clave API de Gemini.");
        }
      }
    } catch (err: any) {
      if (apiKey) {
        try {
          await generateClientSideReport(apiKey, localPrompt);
        } catch (clientErr: any) {
          setError(clientErr.message);
        }
      } else {
        setShowKeyModal(true);
        setError("Error de conexión. Registre su clave API de Gemini para procesar el reporte de forma directa.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getReportParts = (reportText: string | null) => {
    if (!reportText) return { clinical: '', caregiver: '' };
    
    const splitKey = '### II. MÓDULO PSICOEDUCATIVO';
    const fallbackKey = 'II. MÓDULO PSICOEDUCATIVO';
    
    let splitIdx = reportText.indexOf(splitKey);
    
    if (splitIdx === -1) {
      splitIdx = reportText.indexOf(fallbackKey);
    }
    
    if (splitIdx !== -1) {
      return {
        clinical: reportText.substring(0, splitIdx).trim(),
        caregiver: reportText.substring(splitIdx).trim()
      };
    }
    
    return {
      clinical: reportText,
      caregiver: reportText
    };
  };

  const { clinical: clinicalReport, caregiver: caregiverReport } = getReportParts(aiReport);

  const handlePrintReport = (view: 'clinical' | 'caregiver') => {
    const reportText = view === 'clinical' ? (clinicalReport || aiReport) : (caregiverReport || aiReport);
    if (!reportText) {
      alert("Por favor, genere el reporte de IA antes de imprimir.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permita las ventanas emergentes (pop-ups) para abrir el formato de impresión.");
      return;
    }

    const title = view === 'clinical' ? 'Reporte Clínico de Triaje TEA (Profesional)' : 'Plan de Acción y Acompañamiento Familiar';
    const patientName = patientData.name || 'Anónimo';
    const patientAge = `${ageMonths} meses` + (patientData.gestationalWeeks && patientData.gestationalWeeks < 37 ? ' (Edad Corregida)' : '');
    const patientSex = patientData.sex || 'No especificado';
    const dateStr = new Date(session.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const htmlContent = `
      <html>
        <head>
          <title>${title} - ${patientName}</title>
          <style>
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: ${view === 'clinical' ? '#1e1b4b' : '#064e3b'};
              margin: 0 0 15px 0;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 12px;
              font-size: 13px;
              color: #475569;
              background-color: #f8fafc;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #f1f5f9;
            }
            .meta-item {
              margin-bottom: 5px;
            }
            .report-content {
              font-size: 14px;
              color: #334155;
            }
            h1, h2, h3 {
              color: ${view === 'clinical' ? '#312e81' : '#0f766e'};
              font-weight: 700;
              margin-top: 25px;
              margin-bottom: 10px;
            }
            h1 { font-size: 19px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
            h2 { font-size: 16px; }
            h3 { font-size: 14px; }
            p { margin-bottom: 12px; text-align: justify; }
            ul, ol { margin-left: 20px; margin-bottom: 15px; }
            li { margin-bottom: 6px; }
            blockquote {
              background: #f8fafc;
              border-left: 4px solid #cbd5e1;
              margin: 1.5em 10px;
              padding: 0.5em 15px;
              font-style: italic;
            }
            .warning-box {
              background-color: #fffbeb;
              border: 1px solid #fde68a;
              color: #78350f;
              padding: 15px;
              border-radius: 6px;
              margin-top: 40px;
              font-size: 12px;
              line-height: 1.4;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${title}</h1>
            <div class="meta-grid">
              <div class="meta-item"><strong>Paciente:</strong> ${patientName}</div>
              <div class="meta-item"><strong>Fecha de Registro:</strong> ${dateStr}</div>
              <div class="meta-item"><strong>Edad de Triaje:</strong> ${patientAge}</div>
              <div class="meta-item"><strong>Sexo:</strong> ${patientSex}</div>
              <div class="meta-item"><strong>Tipo de Tamizaje:</strong> Digital M-CHAT-R/F</div>
              <div class="meta-item"><strong>Filtros Biológicos:</strong> Audición y Visión Evaluados</div>
            </div>
          </div>
          
          <div class="report-content">
            ${formatMarkdownToHtml(reportText)}
          </div>
          
          <div class="footer">
            Generado automáticamente por la Plataforma NeuroScreen 360 &bull; Conforme a estándares DSM-5 / CIE-11
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      
      {/* Selector de Vistas Duales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800">Panel de Resultados y Triaje</h2>
          <p className="text-xs text-slate-500">Cambie entre la analítica clínica avanzada y el plan de acompañamiento familiar.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => setActiveView('clinical')}
            className={`px-4 py-2 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
              activeView === 'clinical'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 cursor-pointer'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vista Profesional (Clínica)
          </button>
          <button
            onClick={() => setActiveView('caregiver')}
            className={`px-4 py-2 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
              activeView === 'caregiver'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 cursor-pointer'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Vista Familiar / Cuidador
          </button>
        </div>
      </div>

      {activeView === 'clinical' ? (
        /* ================= VISTA CLINICA PROFESIONAL ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          <div className="lg:col-span-7 flex flex-col gap-6 lg:h-full overflow-y-auto">
            <section className="bg-white border border-slate-200 rounded-xl flex flex-col shrink-0 min-h-[300px] shadow-sm">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-700">Matriz de Screening: Dominios Críticos</h3>
                {results.redFlagsDetected.length > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-full uppercase">
                    {results.redFlagsDetected.length} Alertas Rojas
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded-full uppercase">
                    Sin Alertas Críticas
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 border-b border-slate-100 shadow-sm z-10">
                    <tr className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      <th className="px-6 py-3">Ítem de Evaluación</th>
                      <th className="px-4 py-3">Dominio</th>
                      <th className="px-4 py-3 text-center">Respuesta (SÍ/NO)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {itemsArray.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                           {item.is_critical && item.intensity === 1 && <span className="text-[9px] font-extrabold text-rose-700 bg-rose-100 border border-rose-200 rounded px-1.5 py-0.5 shrink-0 uppercase tracking-wide">Crítico</span>}
                           {item.is_red_flag && !item.is_critical && item.intensity === 1 && <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>}
                           {item.text_es}
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {item.domain}
                        </td>
                        <td className="px-4 py-4">
                           <div className={`text-center font-bold mx-auto px-2 h-8 flex items-center justify-center rounded text-xs ${
                             item.intensity === 1 
                               ? item.is_critical 
                                 ? 'text-rose-700 bg-rose-100 border border-rose-200' 
                                 : 'text-rose-600 bg-rose-50' 
                               : 'text-slate-500 bg-slate-50 border border-slate-100'
                           }`}>
                             {item.intensity === 1 ? 'SÍ (Riesgo)' : 'NO (Normal)'}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {historyData.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-xl flex flex-col shrink-0 min-h-[300px] shadow-sm p-6 mb-6">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-700">Evolución Histórica de Riesgo Global</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-1">Línea de Tiempo</p>
                </div>
                <div className="flex-1 w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, 'Índice Global']}
                        labelStyle={{ color: '#475569', fontWeight: 600, fontSize: 12 }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: 'none' }}
                      />
                      <Line type="monotone" dataKey="riesgo" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#FFFFFF' }} activeDot={{ r: 6, fill: '#4F46E5', stroke: '#FFFFFF' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </div>
          
          <div className="lg:col-span-5 flex flex-col gap-6 lg:overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6">Perfil de Riesgo por Dominio</h3>
              <div className="h-48 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="domain" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#E2E8F0" />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Riesgo']} 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: 'none' }}
                    />
                    <Radar name="Paciente" dataKey="riesgo" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.2} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                 {Object.entries(results.domainRisks).slice(0, 4).map(([domain, data], idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider truncate">{domain}</p>
                      <p className={`text-xl font-bold ${data.riskPercentage > 50 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {data.riskPercentage.toFixed(0)}%
                      </p>
                    </div>
                 ))}
              </div>
            </div>
            
            {/* Reporte IA - Formato Clínico */}
            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md flex-1 flex flex-col min-h-[350px]">
              <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">I. Resumen de Análisis IA Clínica</h3>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {aiReport && (
                    <button 
                      onClick={() => handlePrintReport('clinical')}
                      title="Imprimir / Guardar PDF"
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-indigo-100 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir
                    </button>
                  )}
                  {apiKey && (
                    <button 
                      onClick={handleClearApiKey}
                      title="Eliminar Clave API"
                      className="p-1 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowKeyModal(true)}
                    title="Configurar Clave API"
                    className="p-1 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-teal-400 rounded transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-5 8a3 3 0 11-6 0 3 3 0 016 0zM12 7a5 5 0 1110 0v3.586a1 1 0 01-.293.707l-2 2a1 1 0 01-.707.293H16" />
                    </svg>
                  </button>
                  {!aiReport && (
                    <button 
                      onClick={handleGenerateReport} 
                      disabled={isGenerating}
                      className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 border border-indigo-500 text-indigo-50 rounded text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isGenerating ? 'Generando...' : 'Generar Reporte'}
                    </button>
                  )}
                </div>
              </div>
              
              {error && (
                <div className="mb-4 text-xs bg-rose-500/20 text-rose-200 p-2.5 rounded border border-rose-500/30">
                  {error}
                </div>
              )}
              
              {aiReport ? (
                <div className="flex-1 overflow-y-auto pr-2 text-xs leading-relaxed font-light text-slate-200 markdown-container">
                  <Markdown>{clinicalReport || aiReport}</Markdown>
                </div>
              ) : (
                <div className="flex-1 text-xs leading-relaxed text-slate-400 mb-4 flex items-center justify-center text-center">
                   {isGenerating ? 'Ejecutando algoritmos clínicos y de enmascaramiento...' : 'Haga clic en "Generar Reporte" para procesar el análisis de variables biológicas y criterios DSM-5.'}
                </div>
              )}
              
              <div className="flex gap-2 flex-wrap mt-4 pt-3 border-t border-slate-800 shrink-0">
                <div className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                  results.riskLevel === 'Alto'
                    ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                    : results.riskLevel === 'Moderado'
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                      : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                }`}>
                  Riesgo {results.riskLevel} (Puntaje: {results.score}/6)
                </div>
                {results.criticalTriggerActive && (
                  <div className="px-2 py-0.5 bg-rose-600/20 rounded border border-rose-600/30 text-[10px] font-bold text-rose-200">
                    Alerta Crítica Activada
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= VISTA FAMILIAR / CUIDADOR ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-teal-50/20 border border-teal-100 p-6 rounded-2xl animate-in fade-in duration-300">
          
          {/* Columna Izquierda: Reporte Psicoeducativo de la IA */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white border border-teal-50 rounded-xl p-6 shadow-sm flex flex-col min-h-[350px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-800">Plan de Acompañamiento y Apoyo Familiar</h3>
                </div>
                <div className="flex items-center gap-2">
                  {aiReport && (
                    <button
                      onClick={() => handlePrintReport('caregiver')}
                      className="px-3 py-1.5 border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir Plan
                    </button>
                  )}
                  {!aiReport && (
                    <button
                      onClick={handleGenerateReport}
                      disabled={isGenerating}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isGenerating ? 'Generando Plan...' : 'Crear Plan de Apoyo'}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-4 text-xs bg-rose-50 text-rose-700 p-2.5 rounded border border-rose-150">
                  {error}
                </div>
              )}

              {aiReport ? (
                <div className="flex-1 text-slate-700 text-xs leading-relaxed font-normal overflow-y-auto pr-2 markdown-container">
                  <Markdown>{caregiverReport || aiReport}</Markdown>
                </div>
              ) : (
                <div className="flex-1 text-xs text-slate-500 flex flex-col items-center justify-center text-center p-6 gap-2">
                  <p className="font-semibold text-slate-700">¿Desea crear una guía adaptada para el hogar?</p>
                  <p className="max-w-md text-[11px] text-slate-400">Al presionar \"Crear Plan de Apoyo\", la IA estructurará pautas empáticas y prácticas, explicando próximos pasos clínicos sin etiquetas diagnósticas limitantes.</p>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Módulos de Apoyo Interactivos ABA en el Hogar */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white border border-teal-50 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-teal-800 mb-2">Módulos de Apoyo Práctico (ABA)</h3>
              <p className="text-[11px] text-slate-500 mb-6">Implemente y monitoree estas pautas en el hogar mientras espera la evaluación clínica presencial.</p>

              <div className="space-y-6">
                
                {/* Modulo 1 */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-teal-600 bg-teal-150 font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">1</span>
                    <h4 className="text-xs font-bold text-slate-700">Organización Visual y Rutinas</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                    Estructure rutinas diarias predecibles paso a paso para mitigar la ansiedad y dar seguridad.
                  </p>
                  <div className="space-y-2 text-[11px] text-slate-650">
                    {[
                      { key: "visual_schedule", text: "Crear un panel de actividades diario con fotos u objetos representativos." },
                      { key: "task_chunking", text: "Dividir las tareas en micro-pasos (ej. cepillarse los dientes en 3 pasos)." },
                      { key: "transition_alerts", text: "Avisar los cambios de actividad con 5 minutos de anticipación." }
                    ].map(item => (
                      <label key={item.key} className="flex items-start gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-3.5 h-3.5 mt-0.5 rounded text-teal-650 border-slate-300 focus:ring-teal-500 cursor-pointer"
                          checked={abaChecklist[item.key]} 
                          onChange={() => toggleAbaItem(item.key)} 
                        />
                        <span className={abaChecklist[item.key] ? 'line-through text-slate-400 font-medium' : ''}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Modulo 2 */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-teal-600 bg-teal-150 font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">2</span>
                    <h4 className="text-xs font-bold text-slate-700">Adaptación Sensorial del Entorno</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                    Identifique hipersensibilidad o hiposensibilidad y establezca zonas de calma sensorial.
                  </p>
                  <div className="space-y-2 text-[11px] text-slate-650">
                    {[
                      { key: "calm_zone", text: "Crear un rincón de retiro tranquilo, sin juguetes ruidosos o luces directas." },
                      { key: "dim_lighting", text: "Evitar luces fluorescentes parpadeantes en los espacios comunes del menor." },
                      { key: "sensory_adjust", text: "Identificar y adaptar texturas molestas (ej. cortar etiquetas de ropa)." }
                    ].map(item => (
                      <label key={item.key} className="flex items-start gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-3.5 h-3.5 mt-0.5 rounded text-teal-650 border-slate-300 focus:ring-teal-500 cursor-pointer"
                          checked={abaChecklist[item.key]} 
                          onChange={() => toggleAbaItem(item.key)} 
                        />
                        <span className={abaChecklist[item.key] ? 'line-through text-slate-400 font-medium' : ''}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Modulo 3 */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-teal-600 bg-teal-150 font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">3</span>
                    <h4 className="text-xs font-bold text-slate-700">Refuerzo Positivo Continuo</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                    Elogie y recompense las conductas positivas inmediatamente para fomentar nuevas habilidades.
                  </p>
                  <div className="space-y-2 text-[11px] text-slate-650">
                    {[
                      { key: "identify_motivators", text: "Registrar qué actividades u objetos motivan e interesan más al niño." },
                      { key: "immediate_reinforcement", text: "Reforzar al instante cuando establezca contacto visual o responda al nombre." },
                      { key: "positive_redirection", text: "Evitar gritos durante desregulaciones, redirigir verbalmente con tono suave." }
                    ].map(item => (
                      <label key={item.key} className="flex items-start gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-3.5 h-3.5 mt-0.5 rounded text-teal-650 border-slate-300 focus:ring-teal-500 cursor-pointer"
                          checked={abaChecklist[item.key]} 
                          onChange={() => toggleAbaItem(item.key)} 
                        />
                        <span className={abaChecklist[item.key] ? 'line-through text-slate-400 font-medium' : ''}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de API Key Gemini */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-800">Clave API de Gemini (Uso Local/Estático)</h3>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Dado que este entorno es estático (alojado en GitHub Pages), para habilitar la generación del informe clínico por IA debe ingresar una clave API de Gemini. 
              <br /><br />
              La clave se guarda localmente de forma segura en su navegador y se utiliza únicamente para realizar la solicitud directa a Google.
            </p>
            
            <div className="space-y-3 mb-5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Clave API de Gemini</label>
              <input 
                type="password"
                placeholder="Ej: AIzaSyD..."
                className="w-full border border-slate-200 rounded-md p-3 text-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                ¿No tiene una? Obtenga una clave gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-650 underline hover:text-teal-850">Google AI Studio</a>.
              </p>
            </div>
            
            <div className="flex justify-end gap-3 text-xs font-semibold">
              {apiKey && (
                <button 
                  onClick={handleClearApiKey}
                  className="px-4 py-2 border border-rose-200 text-rose-600 rounded hover:bg-rose-50 cursor-pointer mr-auto"
                >
                  Eliminar Clave
                </button>
              )}
              <button 
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 cursor-pointer"
              >
                Guardar Clave
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

// Funciones de formateo de Markdown a HTML para impresión
function formatMarkdownToHtml(markdown: string) {
  const lines = markdown.split('\n');
  const newLines: string[] = [];
  let inList = false;
  let inQuote = false;
  let inWarning = false;

  for (let line of lines) {
    let trimmed = line.trim();

    // Listas desordenadas
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!inList) {
        newLines.push('<ul>');
        inList = true;
      }
      let content = trimmed.substring(2);
      content = processInlineFormatting(content);
      newLines.push(`<li>${content}</li>`);
      continue;
    } else {
      if (inList) {
        newLines.push('</ul>');
        inList = false;
      }
    }

    // Citas y cuadros de advertencia (warning block)
    if (trimmed.startsWith('>')) {
      let content = trimmed.substring(1).trim();
      
      if (content.startsWith('[!WARNING]')) {
        inWarning = true;
        newLines.push('<div class="warning-box">');
        continue;
      }
      
      content = processInlineFormatting(content);
      
      if (inWarning) {
        newLines.push(`<p>${content}</p>`);
      } else {
        if (!inQuote) {
          newLines.push('<blockquote>');
          inQuote = true;
        }
        newLines.push(`<p>${content}</p>`);
      }
      continue;
    } else {
      if (inWarning) {
        newLines.push('</div>');
        inWarning = false;
      }
      if (inQuote) {
        newLines.push('</blockquote>');
        inQuote = false;
      }
    }

    // Encabezados
    if (trimmed.startsWith('### ')) {
      newLines.push(`<h3>${processInlineFormatting(trimmed.substring(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      newLines.push(`<h2>${processInlineFormatting(trimmed.substring(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      newLines.push(`<h1>${processInlineFormatting(trimmed.substring(2))}</h1>`);
    } else if (trimmed) {
      // Párrafos comunes
      newLines.push(`<p>${processInlineFormatting(trimmed)}</p>`);
    } else {
      newLines.push('');
    }
  }

  // Cerrar bloques abiertos al final del archivo si aplica
  if (inList) newLines.push('</ul>');
  if (inWarning) newLines.push('</div>');
  if (inQuote) newLines.push('<blockquote>');

  return newLines.join('\n');
}

function processInlineFormatting(text: string): string {
  let res = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Negrita
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Cursiva
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  return res;
}
