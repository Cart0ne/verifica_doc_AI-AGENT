import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Loader2, Trash2 } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [committente, setCommittente] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setFiles(prev => [...prev, ...uploadedFiles]);
    setError(null);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeDocuments = async () => {
    if (files.length === 0 || !companyName.trim()) {
      setError('Inserisci la ragione sociale e carica almeno un file PDF.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const fileData = await Promise.all(files.map(async (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({
            inlineData: { data: reader.result.split(',')[1], mimeType: 'application/pdf' }
          });
          reader.readAsDataURL(file);
        });
      }));

      const prompt = `Analizza i documenti dell'impresa ${companyName}. 
      Verifica: Visura (entro 6 mesi), DURC (in corso di validità), DVR (presenza firme DL, RSPP, Medico, RLS), Patente a crediti.
      Rispondi SOLO con un JSON così strutturato:
      {
        "conformita_generale": true,
        "documenti": {
          "visura": {"conforme": true, "note": "..."},
          "durc": {"conforme": true, "note": "..."},
          "dvr": {"conforme": true, "note": "..."},
          "patente": {"conforme": true, "note": "..."}
        },
        "note_finali": "..."
      }`;

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...fileData] }] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const textResponse = data.candidates[0].content.parts[0].text;
      const cleanJson = textResponse.replace(/```json|```/g, "").trim();
      setResults(JSON.parse(cleanJson));

    } catch (err) {
      console.error(err);
      setError("Errore tecnico: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Caricamento Dinamico di Excel per evitare la "Pagina Bianca"
  const downloadExcel = () => {
    if (!results) return;
    import('xlsx').then((XLSX) => {
      const dataRows = [
        ["REPORT VERIFICA ITP"],
        ["Impresa", companyName],
        ["Committente", committente],
        ["Cantiere", siteName],
        ["Indirizzo", siteAddress],
        [""],
        ["Documento", "Esito", "Note"]
      ];

      Object.entries(results.documenti).forEach(([key, val]) => {
        dataRows.push([key.toUpperCase(), val.conforme ? "OK" : "NON CONFORME", val.note]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analisi");
      XLSX.writeFile(wb, `Verifica_${companyName.replace(/\s+/g, '_')}.xlsx`);
    }).catch(err => {
      console.error("Errore importazione Excel:", err);
      setError("Errore durante la creazione del file Excel.");
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-10 text-slate-900">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
        <div className="bg-blue-600 p-6 text-white">
          <h1 className="text-2xl font-bold">Verifica ITP Agent</h1>
          <p className="opacity-80">Analisi documentale intelligente D.Lgs 81/08</p>
        </div>

        <div className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Ragione Sociale Impresa *" className="border p-3 rounded-lg w-full" value={companyName} onChange={e => setCompanyName(e.target.value)} />
            <input placeholder="Committente" className="border p-3 rounded-lg w-full" value={committente} onChange={e => setCommittente(e.target.value)} />
            <input placeholder="Nome Cantiere" className="border p-3 rounded-lg w-full" value={siteName} onChange={e => setSiteName(e.target.value)} />
            <input placeholder="Indirizzo Cantiere" className="border p-3 rounded-lg w-full" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Documenti necessari per la verifica ITP
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
              <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> Visura Camerale (max 6 mesi)</li>
              <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> DURC in corso di validità</li>
              <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> DVR (Frontespizio con firme)</li>
              <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> Patente a Crediti / SOA</li>
              <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> Dichiarazione Organico</li>
              <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" /> Dichiarazione Art. 14</li>
            </ul>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:bg-slate-50 transition-colors">
            <input type="file" multiple accept=".pdf" onChange={handleFileUpload} className="hidden" id="file-input" />
            <label htmlFor="file-input" className="cursor-pointer space-y-2 block">
              <Upload className="mx-auto w-10 h-10 text-slate-400" />
              <p className="text-slate-600 font-medium">Trascina i PDF o clicca per caricare</p>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 px-4 rounded-lg border">
                  <span className="text-sm truncate max-w-[300px] font-medium">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 text-sm font-medium">{error}</div>}

          <div className="flex gap-4 pt-2">
            <button 
              onClick={analyzeDocuments} 
              disabled={isAnalyzing || files.length === 0 || !companyName}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center transition-all shadow-sm"
            >
              {isAnalyzing ? <><Loader2 className="mr-2 animate-spin" /> Analisi AI in corso...</> : 'Avvia Verifica ITP'}
            </button>
            
            {results && (
              <button 
                onClick={downloadExcel} 
                className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center"
                title="Scarica Report Excel"
              >
                <Download className="w-6 h-6"/>
              </button>
            )}
          </div>

          {results && (
            <div className="mt-8 border-t pt-8 animate-in fade-in duration-500">
              <h2 className="text-xl font-bold mb-6 flex items-center bg-slate-50 p-4 rounded-lg border">
                Esito Analisi: {results.conformita_generale ? 
                  <span className="ml-2 text-green-600 flex items-center"><CheckCircle className="mr-1 w-6 h-6"/> CONFORME</span> : 
                  <span className="ml-2 text-red-600 flex items-center"><XCircle className="mr-1 w-6 h-6"/> NON CONFORME</span>
                }
              </h2>
              <div className="grid gap-4">
                {Object.entries(results.documenti).map(([key, val]) => (
                  <div key={key} className="p-4 border rounded-xl bg-white shadow-sm flex items-start gap-4">
                    {val.conforme ? <CheckCircle className="text-green-500 mt-1 flex-shrink-0" /> : <AlertCircle className="text-amber-500 mt-1 flex-shrink-0" />}
                    <div>
                      <h4 className="font-bold uppercase text-slate-800 tracking-wide text-sm">{key}</h4>
                      <p className="text-sm text-slate-600 mt-1">{val.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}