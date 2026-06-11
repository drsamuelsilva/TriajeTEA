/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { differenceInMonths, parseISO } from 'date-fns';
import { Patient, EvaluationSession } from './types';
import { TriageEngine } from './lib/triageEngine';
import Dashboard from './components/Dashboard';

import matrixData from './data/matrix.json';

type AppState = 'PATIENT_ENTRY' | 'SCREENING' | 'DASHBOARD';

export default function App() {
  const [appState, setAppState] = useState<AppState>('PATIENT_ENTRY');
  
  // Estados para la PWA (Instalación en celular)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar dispositivos iOS (Safari)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsIOS(isIOSDevice && !isStandalone);

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registrado:', reg.scope))
        .catch(err => console.error('Error al registrar Service Worker:', err));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install choice: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };
  
  const [patientData, setPatientData] = useState<Partial<Patient>>({ 
    evaluations: [],
    sex: 'masculino',
    visionEvaluated: false,
    hearingEvaluated: false,
    developmentalMilestones: []
  });
  const [currentAgeMonths, setCurrentAgeMonths] = useState<number>(0);
  const [chronologicalAgeMonths, setChronologicalAgeMonths] = useState<number>(0);
  
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [session, setSession] = useState<EvaluationSession | null>(null);

  const handleStartScreening = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientData.visionEvaluated || !patientData.hearingEvaluated) {
      alert("Es mandatorio confirmar que las funciones de visión y audición han sido evaluadas por un especialista para descartar diagnósticos diferenciales.");
      return;
    }
    if (patientData.birthDate) {
      const birthDateObj = parseISO(patientData.birthDate);
      const chronMonths = Math.max(0, differenceInMonths(new Date(), birthDateObj));
      let ageMonths = chronMonths;
      
      // Cálculo de Edad Corregida para prematuros (hasta los 24 meses)
      if (patientData.gestationalWeeks && patientData.gestationalWeeks < 37 && chronMonths <= 24) {
         const weeksPremature = 40 - patientData.gestationalWeeks;
         const monthsPremature = Math.floor(weeksPremature / 4.345);
         ageMonths = Math.max(0, chronMonths - monthsPremature);
      }
      
      setChronologicalAgeMonths(chronMonths);
      setCurrentAgeMonths(ageMonths);
      setAppState('SCREENING');
    }
  };

  const handleMilestoneChange = (milestone: string, checked: boolean) => {
    const current = patientData.developmentalMilestones || [];
    const updated = checked 
      ? [...current, milestone]
      : current.filter(m => m !== milestone);
    setPatientData({ ...patientData, developmentalMilestones: updated });
  };

  const handleSubmitScreening = (e: React.FormEvent) => {
    e.preventDefault();
    const results = TriageEngine.calculateResults(responses, currentAgeMonths);
    
    const newSession: EvaluationSession = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      ageMonths: currentAgeMonths,
      responses,
      results
    };
    
    setSession(newSession);
    setPatientData(prev => ({
      ...prev,
      evaluations: [...(prev.evaluations || []), newSession]
    }));
    
    setAppState('DASHBOARD');
  };

  const renderPatientEntry = () => (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-700">Registro de Paciente y Control de Variables Biológicas</h3>
      </div>
      <div className="p-8">
        <form onSubmit={handleStartScreening} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Nombre (Opcional - Uso interno)</label>
              <input 
                type="text" 
                className="w-full border border-slate-200 rounded-md p-3 text-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                placeholder="Ej. Paciente A"
                value={patientData.name || ''}
                onChange={e => setPatientData({...patientData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Fecha de Nacimiento *</label>
              <input 
                type="date" 
                required
                className="w-full border border-slate-200 rounded-md p-3 text-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                value={patientData.birthDate || ''}
                onChange={e => setPatientData({...patientData, birthDate: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Sexo *</label>
              <select 
                required
                className="w-full border border-slate-200 rounded-md p-3 text-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow bg-white"
                value={patientData.sex || 'masculino'}
                onChange={e => setPatientData({...patientData, sex: e.target.value as any})}
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Semanas de Gestación</label>
              <input 
                type="number" 
                min="20"
                max="42"
                className="w-full border border-slate-200 rounded-md p-3 text-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                placeholder="Ej. 38 (Dejar en blanco si > 37)"
                value={patientData.gestationalWeeks || ''}
                onChange={e => setPatientData({...patientData, gestationalWeeks: parseInt(e.target.value) || undefined})}
              />
              <p className="mt-1 text-[10px] text-slate-400">Si es menor a 37 semanas, se ajustará la edad corregida (hasta los 24m).</p>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Hitos del Desarrollo Temprano</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
              {[
                { id: "eye_contact", label: "Establece contacto visual directo" },
                { id: "social_smile", label: "Responde con sonrisa social" },
                { id: "pointing", label: "Apunta con el dedo para mostrar interés" },
                { id: "babbling", label: "Balbuceo o palabras sencillas (mamá/papá)" }
              ].map(milestone => (
                <label key={milestone.id} className="flex items-center gap-3 cursor-pointer text-sm text-slate-700">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                    checked={(patientData.developmentalMilestones || []).includes(milestone.id)}
                    onChange={e => handleMilestoneChange(milestone.id, e.target.checked)}
                  />
                  {milestone.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Control Clínico Obligatorio (Diagnóstico Diferencial) *</label>
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg space-y-3">
              <p className="text-[11px] text-rose-800 font-semibold leading-relaxed">
                IMPORTANTE: Para prevenir falsos positivos o diagnósticos erróneos, es mandatorio que las funciones auditivas y visuales del menor hayan sido evaluadas previamente por su respectivo especialista médico.
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-800 font-medium">
                  <input 
                    type="checkbox" 
                    required
                    className="w-4 h-4 mt-0.5 rounded text-rose-600 border-rose-300 focus:ring-rose-500"
                    checked={patientData.visionEvaluated || false}
                    onChange={e => setPatientData({...patientData, visionEvaluated: e.target.checked})}
                  />
                  <span>Confirmo que la **Visión** del infante ha sido evaluada y descartada de problemas mayores por un especialista.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-800 font-medium">
                  <input 
                    type="checkbox" 
                    required
                    className="w-4 h-4 mt-0.5 rounded text-rose-600 border-rose-300 focus:ring-rose-500"
                    checked={patientData.hearingEvaluated || false}
                    onChange={e => setPatientData({...patientData, hearingEvaluated: e.target.checked})}
                  />
                  <span>Confirmo que la **Audición** del infante ha sido evaluada y descartada de problemas mayores por un especialista.</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Antecedentes Clínicos / Observaciones</label>
            <textarea 
              className="w-full border border-slate-200 rounded-md p-3 text-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow h-24 resize-none"
              placeholder="Antecedentes perinatales, familiares, etc."
              value={patientData.history || ''}
              onChange={e => setPatientData({...patientData, history: e.target.value})}
            />
          </div>
          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={!patientData.visionEvaluated || !patientData.hearingEvaluated}
              className={`px-6 py-3 rounded-md text-sm font-medium shadow-sm transition-all ${
                patientData.visionEvaluated && patientData.hearingEvaluated
                  ? "bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              Iniciar Tracking
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderScreening = () => {
    const ageGroup = TriageEngine.determineAgeGroup(currentAgeMonths);
    const questions = TriageEngine.getApplicableItems(ageGroup);

    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700">Cuestionario de Evaluación</h3>
            <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full uppercase tracking-wider">
              {questions.length} Ítems Activos
            </span>
          </div>
          
          <form onSubmit={handleSubmitScreening}>
            <div className="divide-y divide-slate-50">
              {questions.map((q) => (
                <div key={q.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                         {q.is_red_flag && <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>}
                         {q.is_masking_indicator && <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div>}
                         <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{q.domain}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-800">{q.text_es}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: 0, label: 'Ausente (0)' },
                      { value: 1, label: 'Sinal Leve (+)' },
                      { value: 2, label: 'Sinal Moderado (++)' },
                      { value: 3, label: 'Sinal Grave (+++)' }
                    ].map(opt => (
                      <label 
                        key={opt.value} 
                        className={`cursor-pointer border rounded-md p-3 text-center transition-all ${responses[q.id] === opt.value ? 'bg-indigo-50/60 border-indigo-400 text-indigo-850 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50/50 hover:border-slate-300'}`}
                      >
                        <input 
                          type="radio" 
                          name={q.id} 
                          value={opt.value} 
                          checked={responses[q.id] === opt.value}
                          onChange={() => setResponses({...responses, [q.id]: opt.value})}
                          className="hidden"
                          required
                        />
                        <span className="text-xs font-bold">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors">
                Finalizar Sesión
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden font-sans text-slate-800 bg-[#F8FAFC]">
      <aside className="w-64 bg-slate-800 flex-col border-r border-slate-700 shrink-0 hidden md:flex">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded bg-indigo-500"></div>
            <h1 className="text-white font-bold text-lg tracking-tight">NeuroScreen 360</h1>
          </div>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest leading-none">Triage & Monitoring</p>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <div className={`p-3 rounded-lg flex items-center gap-3 transition-colors ${appState === 'SCREENING' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            {appState === 'SCREENING' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0"></div>}
            <span className="text-sm font-medium">Evaluación Activa</span>
          </div>
          <div className={`p-3 rounded-lg flex items-center gap-3 transition-colors ${appState === 'PATIENT_ENTRY' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700 cursor-pointer'}`} onClick={() => {
              if(appState !== 'PATIENT_ENTRY') {
                setAppState('PATIENT_ENTRY');
                setSession(null);
                setResponses({});
                setPatientData({});
              }
            }}>
            <span className="text-sm font-medium">Nuevo Paciente</span>
          </div>
          <div className={`p-3 rounded-lg flex items-center gap-3 transition-colors ${appState === 'DASHBOARD' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            <span className="text-sm font-medium">Historial Clínico</span>
          </div>
        </nav>
        <div className="p-6 mt-auto border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-650 flex items-center justify-center text-slate-350 font-bold shrink-0">DR</div>
            <div>
              <p className="text-xs text-white font-semibold">Dr. Rodríguez</p>
              <p className="text-[10px] text-slate-400">Neuropediatra</p>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 py-2 px-3 border border-slate-700 rounded bg-slate-700/50">Compliant with HIPAA/GDPR</div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between shrink-0">
          {patientData.name || patientData.birthDate ? (
            <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
              <div>
                <span className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Paciente:</span>
                <span className="ml-2 text-lg font-bold text-slate-900">{patientData.name || 'Anónimo'}</span>
              </div>
              {currentAgeMonths > 0 && (
                <div className="flex items-center gap-3">
                  <div className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 text-[10px] md:text-xs font-semibold">
                    Grupo {TriageEngine.determineAgeGroup(currentAgeMonths)}
                  </div>
                  <div className="text-slate-400 text-[10px] md:text-xs flex gap-2">
                    <span>Edad: {chronologicalAgeMonths}m</span>
                    {currentAgeMonths !== chronologicalAgeMonths && (
                      <span className="font-semibold text-teal-600">(Corregida: {currentAgeMonths}m)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-4 mt-2 md:mt-0">
              <span className="text-lg font-bold text-slate-900">Bienvenido</span>
            </div>
          )}
          <div className="flex gap-3 items-center">
            {isInstallable && (
              <button 
                onClick={handleInstallApp}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Instalar App
              </button>
            )}
            {isIOS && (
              <button 
                onClick={() => alert("Para instalar en iOS (Safari):\n1. Pulse el botón 'Compartir' (cuadrado con flecha hacia arriba).\n2. Seleccione 'Añadir a la pantalla de inicio'.")}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                </svg>
                Instalar iOS
              </button>
            )}
            {session && (
               <button onClick={() => {
                  setAppState('PATIENT_ENTRY');
                  setSession(null);
                  setResponses({});
                  setPatientData({});
                }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200 transition-colors">
                Nueva Consulta
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {appState === 'PATIENT_ENTRY' && renderPatientEntry()}
          {appState === 'SCREENING' && renderScreening()}
          {appState === 'DASHBOARD' && session && (
            <Dashboard 
              patientData={patientData} 
              session={session} 
              onReset={() => {
                setAppState('PATIENT_ENTRY');
                setSession(null);
                setResponses({});
                setPatientData({});
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
