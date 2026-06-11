import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Engine AI LLM Route 
  app.post("/api/generate-report", async (req, res) => {
    try {
      const {
        ageGroup,
        ageMonths,
        history,
        sex,
        visionEvaluated,
        hearingEvaluated,
        developmentalMilestones,
        riskDomains,
        redFlags,
        maskingIndicators
      } = req.body;

      const riskDomainsStr = Object.entries(riskDomains)
        .map(([domain, obj]: [string, any]) => `${domain}: ${obj.riskPercentage.toFixed(1)}%`)
        .join(', ');

      const redFlagsStr = redFlags.length > 0 ? redFlags.map((i: any) => i.text_es).join('; ') : "Ninguna";
      const maskingStr = maskingIndicators.length > 0 ? maskingIndicators.map((i: any) => i.text_es).join('; ') : "Ninguno";
      const milestonesStr = developmentalMilestones && developmentalMilestones.length > 0 
        ? developmentalMilestones.join(', ') 
        : "Ninguno reportado";

      const prompt = `SYSTEM_INSTRUCTION: Arquitecto de Soluciones Médicas e Integradoras en Neurodesarrollo (App Triaje TEA)

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
- Sexo: ${sex || "No especificado"}
- Edad cronológica/corregida: ${ageMonths} meses (Grupo de Edad: ${ageGroup})
- Descarte de Audición Evaluado por Especialista: ${hearingEvaluated ? "SÍ (Confirmado)" : "NO (Pendiente)"}
- Descarte de Visión Evaluado por Especialista: ${visionEvaluated ? "SÍ (Confirmado)" : "NO (Pendiente)"}
- Hitos del Desarrollo Temprano Observados: ${milestonesStr}
- Antecedentes Clínicos / Observaciones: ${history || "No especificados"}
- Porcentajes de Riesgo por Dominio de Screening: ${riskDomainsStr}
- Banderas Rojas (Alertas Críticas Activas): ${redFlagsStr}
- Indicadores de Enmascaramiento Parental (Masking): ${maskingStr}

ESTRUCTURA DE SALIDA REQUERIDA:
Debes generar dos bloques claramente diferenciados y estructurados de forma simultánea, utilizando exactamente los siguientes encabezados para facilitar la separación por el software:

### I. MÓDULO CLÍNICO (Para el Profesional de la Salud)
Este bloque está diseñado con un formato analítico avanzado y terminología clínica estandarizada para optimizar y agilizar los tiempos de derivación médica:
1. **Estatus de Descarte Biológico Directo (Control de Diagnóstico Diferencial):** Validación explícita de que las funciones de audición y visión han sido consideradas o evaluadas previamente por su respectivo especialista. Esto garantiza que posibles déficits sensoriales no estén distorsionando el perfil conductual del infante. Registro de hitos del desarrollo físico y antecedentes perinatales de riesgo biológico inmediato.
2. **Métricas de Cribado Psicométrico (Screening Cuantitativo):** Puntuación Total Obtenida en el M-CHAT-R/F (o la escala correspondiente según el hito). Desglose del nivel de riesgo psicométrico actual (Bajo, Medio o Alto). Identificación de los ítems críticos fallados en la entrevista o seguimiento conductual automatizado.
3. **Mapeo de Criterios Diagnósticos según el DSM-5 / CIE-11:** Mapea la presencia y afectación en:
   - Dominio A (Comunicación e Interacción Social): Análisis predictivo del algoritmo sobre la presencia y el nivel de afectación en la reciprocidad socioemocional, comunicación no verbal y el desarrollo/mantenimiento de relaciones.
   - Dominio B (Patrones de Conducta Restringidos y Repetitivos): Resumen analítico de conductas estereotipadas (motoras o verbales), insistencia en la monotonía/rutinas, intereses altamente fijados o hiper/hiporreactividad sensorial.
4. **Nivel Presuntivo de Gravedad y Soporte Requerido:** Clasificación automatizada según los tres niveles de gravedad dimensionales del DSM-5: Grado 1 ("Necesita ayuda"), Grado 2 ("Necesita ayuda notable") o Grado 3 ("Necesita ayuda muy notable").
5. **Alertas de Comorbilidades e Indicadores de Alarma Inmediata:** Detección presuntiva y señales de riesgo para derivaciones prioritarias o estudios específicos (por ejemplo: sospechas de regresión inexplicada del lenguaje, trastornos del sueño, trastornos de conducta añadidos o signos de inmadurez cortical/epilepsia que ameriten la indicación urgente de un EEG).

### II. MÓDULO PSICOEDUCATIVO (Plan de Acción para Cuidadores y Familias)
Este bloque traduce la analítica de datos a un lenguaje empático, humano y accesible, enfocado en el acompañamiento práctico inmediato:
1. **Marco Conceptual Humanizado (Identidad vs. Descripción):** Un texto introductorio diseñado bajo la premisa de que el resultado de la app es una descripción útil de una lucha y un conjunto de necesidades de soporte, y de ninguna manera una etiqueta que defina la identidad o ponga un límite al valor intrínseco del niño ante su familia y la sociedad (Dignidad Ontológica, Gracia Común e Imago Dei).
2. **Plan Detallado de Enrutamiento y Próximos Pasos:** Guía clara sobre a qué especialistas de la red de salud local o comunitaria se debe acudir en primer lugar (pediatría, neuropediatría, psiquiatría infantil, psicología, terapia del lenguaje o kinesiología). Recomendación de estudios de mayor rentabilidad etiológica (como la sugerencia de asesoramiento y estudios genéticos familiares) explicándoles el valor preventivo del diagnóstico temprano.
3. **Asignación Automática de Módulos de Apoyo (Principios ABA):** Recomendaciones de microaprendizaje adaptadas a los déficits puntuales detectados por el software en casa. Guías visuales y tareas fragmentadas en pasos pequeños y predecibles para el manejo diario de rutinas.
4. **Estrategias Inmediatas de Contención y Adaptación Comunitaria:** Pautas conductuales positivas para mitigar crisis de desregulación en el hogar y consejos prácticos para fomentar la inclusión social del niño en su entorno cotidiano (escuela, actividades familiares y comunidades de fe), proporcionando soporte emocional y reduciendo la ansiedad familiar durante los tiempos de espera clínicos.

DIRECTRICES DE FORMATO:
- Emplea un lenguaje centrado en la persona, libre de sesgos de género u origen.
- Finaliza el reporte agregando el siguiente aviso legal en una caja de alerta destacada:
  "> [!WARNING]
  > **Nota de Descargo:** Esta evaluación es una herramienta de tamizaje de riesgo y no reemplaza la evaluación clínica presencial formal realizada por un equipo de salud multidisciplinario."`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ report: response.text });
    } catch (error: any) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: error.message || "Failed to generate report" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
