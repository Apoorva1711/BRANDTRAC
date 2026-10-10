import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  X,
  Share2,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { brandService, candidateService } from '../services/api';

export function ImportCandidateModal({
  isOpen,
  onClose,
  defaultType = 'social',
  defaultBrandId = '',
  onSuccess
}) {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(defaultBrandId);
  const [candidateType, setCandidateType] = useState(defaultType);
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      brandService.getAll()
        .then((res) => {
          const list = res.brands || [];
          setBrands(list);
          if (!selectedBrandId && list.length > 0) {
            setSelectedBrandId(defaultBrandId || list[0]._id);
          }
        })
        .catch(() => {});
      setCandidateType(defaultType);
      setFile(null);
      setRawText('');
      setParsedItems([]);
      setParseError('');
      setSubmitSuccess('');
    }
  }, [isOpen, defaultType, defaultBrandId]);

  if (!isOpen) return null;

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (vals.length === 0 || (vals.length === 1 && !vals[0])) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] || '';
      });

      // Normalize fields
      const usernameOrAppName = obj.usernameorappname || obj.username || obj.appname || obj.name || obj.handle;
      const platformOrStore = obj.platformorstore || obj.platform || obj.store || obj.storename || (candidateType === 'app' ? 'Google Play' : 'Twitter/X');
      const displayName = obj.displayname || obj.title || usernameOrAppName;
      const url = obj.url || obj.profileurl || obj.listingurl || '';
      const externalUrl = obj.externalurl || obj.website || obj.link || '';
      const description = obj.description || obj.bio || '';
      const publisherName = obj.publishername || obj.publisher || obj.developer || '';
      const packageId = obj.packageid || obj.bundleid || '';
      const followers = parseInt(obj.followers || obj.installs || '0', 10) || 0;

      if (usernameOrAppName) {
        rows.push({
          candidateType,
          usernameOrAppName,
          displayName,
          platformOrStore,
          url,
          externalUrl,
          description,
          publisherName,
          packageId,
          followers
        });
      }
    }

    return rows;
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError('');
    setSubmitSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        let items = [];

        if (selectedFile.name.endsWith('.json')) {
          const json = JSON.parse(content);
          items = Array.isArray(json) ? json : [json];
        } else {
          items = parseCSV(content);
        }

        if (items.length === 0) {
          throw new Error('No valid candidate records could be parsed.');
        }

        setParsedItems(items);
      } catch (err) {
        setParseError(`Parse error: ${err.message}`);
        setParsedItems([]);
      }
    };
    reader.readAsText(selectedFile);
  }

  function handlePasteParse(text) {
    setRawText(text);
    setParseError('');
    setSubmitSuccess('');
    if (!text.trim()) {
      setParsedItems([]);
      return;
    }

    try {
      let items = [];
      const trimmed = text.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        items = Array.isArray(json) ? json : [json];
      } else {
        items = parseCSV(trimmed);
      }
      setParsedItems(items);
    } catch (err) {
      setParseError(`Parse error: ${err.message}`);
      setParsedItems([]);
    }
  }

  function loadSampleData() {
    setParseError('');
    if (candidateType === 'social') {
      const sample = [
        {
          usernameOrAppName: 'stripe_urgent_verify',
          displayName: 'Stripe Account Verification Security Alert',
          platformOrStore: 'Twitter/X',
          url: 'https://twitter.com/stripe_urgent_verify',
          externalUrl: 'https://auth-stripe-kyc-verify.vip',
          description: 'Official emergency verification channel. Re-confirm payment credentials immediately or account suspended.',
          followers: 432
        },
        {
          usernameOrAppName: 'stripe_community_bonus',
          displayName: 'Stripe Rewards & Partner Community',
          platformOrStore: 'Telegram',
          url: 'https://t.me/stripe_community_bonus',
          externalUrl: 'https://stripe-bonus-claim.net',
          description: 'Official Stripe merchant giveaway portal. Double your first 10 payouts by registering wallet address.',
          followers: 2450
        }
      ];
      setRawText(JSON.stringify(sample, null, 2));
      setParsedItems(sample);
      setInputMode('paste');
    } else {
      const sample = [
        {
          usernameOrAppName: 'Stripe Quick Pay Point of Sale',
          displayName: 'Stripe Quick Pay Point of Sale',
          packageId: 'com.stripe.pos.quickpay.express',
          publisherName: 'Global FinTech Apps Ltd',
          platformOrStore: 'Google Play',
          url: 'https://play.google.com/store/apps/details?id=com.stripe.pos.quickpay.express',
          externalUrl: 'https://stripeposquick.apk-store.ru',
          description: 'Accept credit card payments instantly using the official Stripe engine with zero processing commission.',
          followers: 50000
        },
        {
          usernameOrAppName: 'Stripe Merchant Dashboard Helper',
          displayName: 'Stripe Merchant Dashboard Helper',
          packageId: 'org.stripe.merchant.helper',
          publisherName: 'Unknown APK Developer',
          platformOrStore: 'Third-Party APK',
          url: 'https://apkpure.com/stripe-merchant-dashboard-helper',
          externalUrl: 'https://phishing-portal-merchant.info',
          description: 'Unofficial companion app for Stripe sellers to view payouts and verify billing identity.',
          followers: 1200
        }
      ];
      setRawText(JSON.stringify(sample, null, 2));
      setParsedItems(sample);
      setInputMode('paste');
    }
  }

  function downloadTemplate() {
    let headers = '';
    let sampleRow = '';

    if (candidateType === 'social') {
      headers = 'usernameOrAppName,displayName,platformOrStore,url,externalUrl,description,followers\n';
      sampleRow = 'brand_official_alerts,Brand Official Alerts,Twitter/X,https://twitter.com/brand_official_alerts,https://phishing-url.cc,Emergency account notification desk,320\n';
    } else {
      headers = 'usernameOrAppName,displayName,platformOrStore,packageId,publisherName,url,externalUrl,description,followers\n';
      sampleRow = 'Brand Mobile Wallet,Brand Mobile Wallet,Google Play,com.brand.wallet.apk,Unauthorized Studio,https://play.google.com/store/apps/details?id=com.brand.wallet.apk,https://apk-mirror-site.com,Instant wallet payments,15000\n';
    }

    const blob = new Blob([headers + sampleRow], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `brandtrace_${candidateType}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!selectedBrandId) {
      setParseError('Please select a target brand to associate these candidates with.');
      return;
    }

    if (parsedItems.length === 0) {
      setParseError('No candidates to import. Please upload a file or paste candidate data.');
      return;
    }

    try {
      setIsSubmitting(true);
      setParseError('');
      const res = await candidateService.importCandidates({
        brandId: selectedBrandId,
        items: parsedItems
      });

      setSubmitSuccess(res.message || `Successfully ingested ${parsedItems.length} candidate records.`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setParseError(err.message || 'Import failed. Check network or server status.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Import Candidate Surveillance Records</h2>
              <p className="text-xs text-slate-500">Ingest potential look-alike accounts or mobile packages from CSV or JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleImportSubmit} className="p-6 space-y-4 text-xs">
          {submitSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {parseError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Target Monitored Brand *</label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Monitored Brand --</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Surveillance Vector *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setCandidateType('social'); setParsedItems([]); }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded border text-xs font-semibold transition-colors ${
                    candidateType === 'social'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Social Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setCandidateType('app'); setParsedItems([]); }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded border text-xs font-semibold transition-colors ${
                    candidateType === 'app'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mode Switch & Template Tools */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  inputMode === 'upload' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                File Upload (.csv, .json)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  inputMode === 'paste' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Paste Data / Editor
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSampleData}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
              >
                <Sparkles className="w-3 h-3" />
                <span>Load Sample Data</span>
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-800 font-medium ml-2"
              >
                <Download className="w-3 h-3" />
                <span>Download Template CSV</span>
              </button>
            </div>
          </div>

          {/* Input Area */}
          {inputMode === 'upload' ? (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 transition-colors bg-slate-50/50">
              <input
                type="file"
                id="candidate-file-input"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="candidate-file-input" className="cursor-pointer space-y-2 block">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">
                  {file ? file.name : 'Click to select CSV or JSON file'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Accepts standard export files containing handles, store listings, and URLs
                </p>
              </label>
            </div>
          ) : (
            <div>
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => handlePasteParse(e.target.value)}
                placeholder={
                  candidateType === 'social'
                    ? 'Paste JSON array or CSV text with columns: usernameOrAppName, displayName, platformOrStore, url, externalUrl, description...'
                    : 'Paste JSON array or CSV text with columns: usernameOrAppName, packageId, publisherName, platformOrStore, url, externalUrl...'
                }
                className="w-full p-2.5 rounded border border-slate-300 font-mono text-[11px] bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Preview of Parsed Items */}
          {parsedItems.length > 0 && (
            <div className="p-3 bg-blue-50/60 rounded border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900">
                  ✓ Parsed {parsedItems.length} candidate {parsedItems.length === 1 ? 'record' : 'records'} ready for ingestion
                </span>
                <span className="text-[10px] text-blue-700 font-medium uppercase tracking-wider">
                  Type: {candidateType}
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto divide-y divide-blue-100 text-[11px]">
                {parsedItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="py-1 flex items-center justify-between text-slate-700">
                    <span className="font-medium truncate max-w-xs">{item.usernameOrAppName} ({item.platformOrStore})</span>
                    <span className="text-slate-500 truncate max-w-[200px]">{item.publisherName || item.displayName || 'No title'}</span>
                  </div>
                ))}
                {parsedItems.length > 5 && (
                  <div className="py-1 text-[10px] text-blue-600 italic">
                    + {parsedItems.length - 5} more records...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedItems.length === 0 || !selectedBrandId}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting Records...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import {parsedItems.length > 0 ? `${parsedItems.length} Candidates` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
