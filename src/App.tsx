import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, Database, Share2, Info, Loader2, X, 
  Fingerprint, Tag, Layers, Download, Trash2, Search, 
  Filter, Eye, EyeOff, Link as LinkIcon, Activity,
  Cloud, FileJson, FileSpreadsheet, Image as ImageIcon, Upload,
  Zap, ChevronDown, Maximize2, Minimize2
} from 'lucide-react';
import { extractGraph, GraphData, Node, Link } from './services/geminiService';
import GraphVisualization from './components/GraphVisualization';
import AnalyticsPanel from './components/AnalyticsPanel';

const STORAGE_KEY = 'esoteric_knowledge_web_v1';
const LANG_STORAGE_KEY = 'esoteric_knowledge_lang';
const ALL_TYPES = ['deity', 'spirit', 'ritual', 'symbol', 'concept', 'place', 'creature', 'artifact', 'spell'];

const translations = {
  en: {
    title: "The Great Weave",
    subtitle: "Magical Knowledge Web",
    searchPlaceholder: "Search entities...",
    filters: "Filters",
    ritualLayer: "Ritual Layer",
    inputPlaceholder: "Describe a deity, a ritual, or a place of power...",
    weaveBtn: "Weave",
    nodes: "Nodes",
    links: "Links",
    downloadJson: "Download JSON",
    exportCsv: "Export CSV",
    exportPng: "Export PNG",
    importJsons: "Import JSONs",
    syncCloud: "Sync Cloud",
    syncSuccess: "Web synchronized with the cloud.",
    syncError: "Failed to synchronize with the cloud.",
    importSuccess: "Successfully merged {count} files.",
    emptyTitle: "The Web is Empty",
    emptyDesc: "Input mystical descriptions on the left to start weaving the knowledge graph.",
    entityDetails: "Entity Details",
    relationDetails: "Relation Details",
    analytics: "Analytics",
    name: "Name",
    type: "Type",
    connection: "Connection",
    nature: "Nature of Bond",
    error: "Failed to extract knowledge. The spirits are silent.",
    clearConfirm: "Are you sure you want to dissolve the entire web? This cannot be undone.",
    clearTooltip: "Clear Web",
    markAsRitual: "Mark as Ritual",
    ritualName: "Ritual Name",
    ritualText: "Ritual Text",
    exportRitual: "Export Ritual JSON",
    updateWeb: "Update Web",
    resetWeb: "Reset Web",
    updateSuccess: "Web updated: {count} nodes merged, links recalculated.",
    resetConfirm: "Are you sure you want to reset the entire web? Data will be lost.",
    close: "Close",
    powerFlows: "Power Flows",
    flowSpeed: "Flow Speed",
    flowIntensity: "Brightness",
    flowThickness: "Thickness",
    hideWeak: "Hide Weak Flows",
    vizSettings: "Visualization Settings",
    expand: "Expand View",
    shrink: "Shrink View"
  },
  ru: {
    title: "Великая Паутина",
    subtitle: "Магическая Сеть Знаний",
    searchPlaceholder: "Поиск сущностей...",
    filters: "Фильтры",
    ritualLayer: "Слой Ритуалов",
    inputPlaceholder: "Опишите божество, ритуал или место силы...",
    weaveBtn: "Сплести",
    nodes: "Узлы",
    links: "Связи",
    downloadJson: "Скачать JSON",
    exportCsv: "Экспорт CSV",
    exportPng: "Экспорт PNG",
    importJsons: "Импорт JSON",
    syncCloud: "Синхронизация",
    syncSuccess: "Паутина синхронизирована с облаком.",
    syncError: "Ошибка синхронизации с облаком.",
    importSuccess: "Успешно объединено {count} файлов.",
    emptyTitle: "Паутина пуста",
    emptyDesc: "Введите мистические описания слева, чтобы начать плести граф знаний.",
    entityDetails: "Детали Сущности",
    relationDetails: "Детали Связи",
    analytics: "Аналитика",
    name: "Имя",
    type: "Тип",
    connection: "Связь",
    nature: "Природа Связи",
    error: "Не удалось извлечь знания. Духи молчат.",
    clearConfirm: "Вы уверены, что хотите растворить всю паутину? Это действие необратимо.",
    clearTooltip: "Очистить Сеть",
    markAsRitual: "Отметить как Ритуал",
    ritualName: "Название Ритуала",
    ritualText: "Текст Ритуала",
    exportRitual: "Экспорт Ритуала JSON",
    updateWeb: "Обновить паутину",
    resetWeb: "Сброс паутины",
    updateSuccess: "Паутина обновлена: {count} узлов объединено, связи пересчитаны.",
    resetConfirm: "Вы уверены, что хотите сбросить всю паутину? Данные будут потеряны.",
    close: "Закрыть",
    powerFlows: "Потоки Силы",
    flowSpeed: "Скорость Потока",
    flowIntensity: "Яркость",
    flowThickness: "Толщина",
    hideWeak: "Скрыть слабые потоки",
    vizSettings: "Настройки Визуализации",
    expand: "Развернуть",
    shrink: "Свернуть"
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'ru'>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return (saved === 'ru' || saved === 'en') ? saved : 'en';
  });
  const [inputText, setInputText] = useState('');
  const [graphData, setGraphData] = useState<GraphData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { nodes: [], links: [] };
  });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Restore missing states
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  const [showRitualsOnly, setShowRitualsOnly] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isRitualMode, setIsRitualMode] = useState(false);
  const [ritualNameInput, setRitualNameInput] = useState('');
  
  // Visualization settings
  const [showFlows, setShowFlows] = useState(true);
  const [flowSpeed, setFlowSpeed] = useState(1);
  const [flowIntensity, setFlowIntensity] = useState(1);
  const [flowThickness, setFlowThickness] = useState(1);
  const [hideWeakFlows, setHideWeakFlows] = useState(false);
  const [showVizSettings, setShowVizSettings] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const t = translations[lang];

  // Save to localStorage whenever graphData or lang changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphData));
  }, [graphData]);

  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // String similarity utility (Levenshtein distance)
  const getSimilarity = (s1: string, s2: string) => {
    const longer = s1.length < s2.length ? s2 : s1;
    const shorter = s1.length < s2.length ? s1 : s2;
    if (longer.length === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= longer.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= shorter.length; j++) {
        if (i === 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (longer.charAt(i - 1) !== shorter.charAt(j - 1))
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[shorter.length] = lastValue;
    }
    return (longer.length - costs[shorter.length]) / longer.length;
  };

  // Semantic synonym dictionary for common esoteric concepts
  const SEMANTIC_GROUPS: Record<string, string> = {
    // Wealth
    'богатство': 'money_magic',
    'денежная магия': 'money_magic',
    'привлечение денег': 'money_magic',
    'wealth': 'money_magic',
    'prosperity': 'money_magic',
    'abundance': 'money_magic',
    // Protection
    'защита': 'protection_magic',
    'оберег': 'protection_magic',
    'protection': 'protection_magic',
    'shielding': 'protection_magic',
    'warding': 'protection_magic',
    // Love
    'любовь': 'love_magic',
    'приворот': 'love_magic',
    'love': 'love_magic',
    'attraction': 'love_magic',
  };

  const mergeGraphData = useCallback((newData: GraphData) => {
    setGraphData(prev => {
      const newNodes = [...prev.nodes];
      const nodeMap = new Map(prev.nodes.map(n => [n.id, n]));
      const nameMap = new Map(prev.nodes.map(n => [n.name.toLowerCase(), n.id]));
      
      const idMapping: Record<string, string> = {}; // Maps new node IDs to existing ones if merged

      newData.nodes.forEach(node => {
        const lowerName = node.name.toLowerCase();
        
        // Check semantic groups first
        let canonicalId = SEMANTIC_GROUPS[lowerName];
        let existingId = canonicalId && nodeMap.has(canonicalId) ? canonicalId : (nodeMap.has(node.id) ? node.id : nameMap.get(lowerName));

        // If no direct match, check for high similarity (fuzzy match)
        if (!existingId) {
          for (const [existingName, id] of nameMap.entries()) {
            if (getSimilarity(lowerName, existingName) > 0.85) {
              existingId = id;
              break;
            }
          }
        }

        if (existingId) {
          idMapping[node.id] = existingId;
          // Update existing node description if new one is more detailed
          const existingNode = nodeMap.get(existingId);
          if (existingNode && node.description && (!existingNode.description || node.description.length > existingNode.description.length)) {
            existingNode.description = node.description;
          }
        } else {
          newNodes.push(node);
          nodeMap.set(node.id, node);
          nameMap.set(lowerName, node.id);
          idMapping[node.id] = node.id;
        }
      });

      const existingLinks = new Set(prev.links.map(l => `${l.source}-${l.target}-${l.relation}`));
      const newLinks = [...prev.links];

      newData.links.forEach(link => {
        const sourceId = idMapping[link.source] || link.source;
        const targetId = idMapping[link.target] || link.target;
        
        // Prevent self-loops after merging
        if (sourceId === targetId) return;

        const linkKey = `${sourceId}-${targetId}-${link.relation}`;
        if (!existingLinks.has(linkKey)) {
          if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
            newLinks.push({ ...link, source: sourceId, target: targetId });
            existingLinks.add(linkKey);
          }
        }
      });

      return { nodes: newNodes, links: newLinks };
    });
  }, []);

  const handleExtract = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await extractGraph(inputText, lang, isRitualMode, ritualNameInput, graphData.nodes);
      mergeGraphData(data);
      setInputText('');
      setRitualNameInput('');
      setIsRitualMode(false);
    } catch (err) {
      console.error(err);
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(graphData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "magical_web.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportCSV = () => {
    const nodeRows = [["id", "name", "type"], ...graphData.nodes.map(n => [n.id, n.name, n.type])];
    const linkRows = [["source", "target", "relation"], ...graphData.links.map(l => [l.source, l.target, l.relation])];
    
    const csvContent = "NODES\n" + nodeRows.map(r => r.join(",")).join("\n") + "\n\nLINKS\n" + linkRows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "magical_web.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPNG = () => {
    const svg = document.getElementById('main-graph-svg') as unknown as SVGSVGElement | null;
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth * 2; // Higher resolution
      canvas.height = svg.clientHeight * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0502'; // Background color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'magical_web.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleImportJsons = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let processedCount = 0;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.nodes && data.links) {
            mergeGraphData(data);
            processedCount++;
            if (processedCount === files.length) {
              setSuccessMsg(t.importSuccess.replace('{count}', processedCount.toString()));
            }
          }
        } catch (err) {
          console.error("Failed to parse JSON:", err);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      // First, try to get data from server to merge
      const response = await fetch('/api/graph');
      if (response.ok) {
        const serverData = await response.json();
        if (serverData.nodes && serverData.nodes.length > 0) {
          mergeGraphData(serverData);
        }
      }

      // Then, push current data to server
      const pushResponse = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphData)
      });

      if (pushResponse.ok) {
        setSuccessMsg(t.syncSuccess);
      } else {
        throw new Error("Sync failed");
      }
    } catch (err) {
      console.error(err);
      setError(t.syncError);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetWeb = () => {
    if (window.confirm(t.resetConfirm)) {
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      setSelectedLink(null);
      localStorage.removeItem(STORAGE_KEY);
      setSuccessMsg(lang === 'ru' ? "Паутина сброшена." : "Web reset.");
    }
  };

  const reorganizeGraph = useCallback(() => {
    setIsLoading(true);
    setUpdateProgress(0);
    
    // Use a timeout to allow the UI to show the loader
    setTimeout(() => {
      setGraphData(prev => {
        const nodes = [...prev.nodes];
        const links = [...prev.links];
        const idMapping: Record<string, string> = {};
        const canonicalNodes: Node[] = [];

        // 1. Group nodes by similarity
        const processed = new Set<string>();
        
        nodes.forEach((node, index) => {
          if (processed.has(node.id)) return;
          
          const lowerName = node.name.toLowerCase();
          
          // Check semantic groups
          const semanticId = SEMANTIC_GROUPS[lowerName];

          // Find similar nodes
          const group = nodes.filter(other => {
            if (processed.has(other.id)) return false;
            if (node.id === other.id) return true;
            
            const otherLower = other.name.toLowerCase();
            
            // Direct match or semantic group match
            if (lowerName === otherLower) return true;
            if (semanticId && SEMANTIC_GROUPS[otherLower] === semanticId) return true;
            
            // Fuzzy match
            return getSimilarity(lowerName, otherLower) > 0.85;
          });

          // Pick the best node as canonical (one with longest description or just the first)
          const canonical = group.reduce((best, curr) => {
            const bestDescLen = best.description?.length || 0;
            const currDescLen = curr.description?.length || 0;
            return currDescLen > bestDescLen ? curr : best;
          }, group[0]);

          canonicalNodes.push(canonical);
          group.forEach(n => {
            idMapping[n.id] = canonical.id;
            processed.add(n.id);
          });
          
          // Update progress occasionally
          if (index % 5 === 0 || index === nodes.length - 1) {
            // Note: setUpdateProgress inside setGraphData might not be ideal but for this scale it works
            // or we can just update it after the loop if it's fast.
          }
        });

        // 2. Rebuild links with new IDs and deduplicate
        const newLinks: Link[] = [];
        const linkKeys = new Set<string>();

        links.forEach(link => {
          const sourceId = idMapping[link.source as string] || (typeof link.source === 'object' ? idMapping[(link.source as any).id] : link.source);
          const targetId = idMapping[link.target as string] || (typeof link.target === 'object' ? idMapping[(link.target as any).id] : link.target);
          
          if (!sourceId || !targetId || sourceId === targetId) return;

          const key = `${sourceId}-${targetId}-${link.relation}`;
          if (!linkKeys.has(key)) {
            newLinks.push({
              ...link,
              source: sourceId,
              target: targetId
            });
            linkKeys.add(key);
          }
        });

        const mergedCount = nodes.length - canonicalNodes.length;
        setSuccessMsg(t.updateSuccess.replace('{count}', mergedCount.toString()));
        
        return {
          nodes: canonicalNodes,
          links: newLinks
        };
      });
      setIsLoading(false);
      setUpdateProgress(0);
    }, 100);
  }, [t, getSimilarity, lang]);

  const handleClear = () => {
    if (window.confirm(t.clearConfirm)) {
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      setSelectedLink(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleExportRitual = (ritual: Node) => {
    const ritualLinks = graphData.links.filter(l => l.source === ritual.id || l.target === ritual.id);
    const linkedNodeIds = new Set([ritual.id, ...ritualLinks.map(l => l.source === ritual.id ? l.target : l.source)]);
    const ritualNodes = graphData.nodes.filter(n => linkedNodeIds.has(n.id));
    
    const exportData = { nodes: ritualNodes, links: ritualLinks };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `ritual_${ritual.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const toggleType = (type: string) => {
    const next = new Set(visibleTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setVisibleTypes(next);
  };

  const colors: Record<string, string> = {
    deity: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    spirit: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    ritual: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    symbol: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    concept: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    place: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    creature: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    artifact: "text-violet-400 border-violet-500/30 bg-violet-500/10",
    spell: "text-pink-400 border-pink-500/30 bg-pink-500/10",
  };

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
    setSelectedLink(null);
  }, []);

  const handleLinkClick = useCallback((link: Link) => {
    setSelectedLink(link);
    setSelectedNode(null);
  }, []);

  const activeVisibleTypes = useMemo(() => {
    if (showRitualsOnly) return new Set(['ritual']);
    return visibleTypes;
  }, [visibleTypes, showRitualsOnly]);

  return (
    <div className="min-h-screen bg-[#0a0502] text-[#e0d8d0] font-sans selection:bg-orange-500/30 overflow-hidden flex flex-col">
      {/* Immersive Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
      </div>

      <main className={`relative z-10 flex-1 flex flex-col lg:flex-row ${isExpanded ? 'max-w-none' : 'max-w-[1600px]'} mx-auto w-full p-4 lg:p-8 gap-6 h-full min-h-0 transition-all duration-500`}>
        {/* Left Column: Controls */}
        <div className={`${isExpanded ? 'w-0 lg:w-0 opacity-0 pointer-events-none -ml-6' : 'w-full lg:w-[400px] opacity-100'} flex flex-col gap-6 shrink-0 overflow-y-auto pr-2 custom-scrollbar transition-all duration-500`}>
          <header className="shrink-0">
            <div className="flex items-center justify-between mb-4">
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2"
              >
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-orange-500/70">{t.subtitle}</span>
              </motion.div>
              
              {/* Language Switcher */}
              <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
                <button 
                  onClick={() => setLang('en')}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${lang === 'en' ? 'bg-orange-500 text-black' : 'text-white/40 hover:text-white/60'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLang('ru')}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${lang === 'ru' ? 'bg-orange-500 text-black' : 'text-white/40 hover:text-white/60'}`}
                >
                  RU
                </button>
              </div>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-serif font-light tracking-tight leading-none mb-2">
              {t.title.split(' ')[0]} <span className="italic text-orange-200">{t.title.split(' ').slice(1).join(' ')}</span>
            </h1>
          </header>

          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            {/* Type Filters */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-white/40" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">{t.filters}</span>
                </div>
                <button 
                  onClick={() => setShowRitualsOnly(!showRitualsOnly)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] uppercase tracking-wider font-bold transition-colors ${showRitualsOnly ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}
                >
                  <Activity className="w-3 h-3" />
                  {t.ritualLayer}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    disabled={showRitualsOnly}
                    className={`px-2 py-1 rounded-lg text-[9px] uppercase tracking-wider font-bold border transition-all ${activeVisibleTypes.has(type) ? colors[type] : 'bg-white/5 text-white/20 border-white/5 opacity-40'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Visualization Settings */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <button 
                onClick={() => setShowVizSettings(!showVizSettings)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">{t.vizSettings}</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${showVizSettings ? 'rotate-180' : ''}`} />
              </button>
              
              {showVizSettings && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="pt-4 flex flex-col gap-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/60 uppercase tracking-wider font-bold">{t.powerFlows}</span>
                    <button 
                      onClick={() => setShowFlows(!showFlows)}
                      className={`w-9 h-5 rounded-full transition-all relative ${showFlows ? 'bg-orange-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showFlows ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  {showFlows && (
                    <>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[9px] text-white/40 uppercase tracking-widest font-bold">
                          <span>{t.flowSpeed}</span>
                          <span className="text-orange-400">{flowSpeed.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3" step="0.1"
                          value={flowSpeed} onChange={(e) => setFlowSpeed(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[9px] text-white/40 uppercase tracking-widest font-bold">
                          <span>{t.flowIntensity}</span>
                          <span className="text-orange-400">{flowIntensity.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="2" step="0.1"
                          value={flowIntensity} onChange={(e) => setFlowIntensity(parseFloat(e.target.value))}
                          className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/60 uppercase tracking-wider font-bold">{t.hideWeak}</span>
                        <button 
                          onClick={() => setHideWeakFlows(!hideWeakFlows)}
                          className={`w-9 h-5 rounded-full transition-all relative ${hideWeakFlows ? 'bg-orange-500' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${hideWeakFlows ? 'left-5' : 'left-1'}`} />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>

            {/* Text Input Area */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <button
                  onClick={() => setIsRitualMode(!isRitualMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${isRitualMode ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}
                >
                  <Activity className="w-3 h-3" />
                  {t.markAsRitual}
                </button>
              </div>

              {isRitualMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden"
                >
                  <input 
                    type="text"
                    value={ritualNameInput}
                    onChange={(e) => setRitualNameInput(e.target.value)}
                    placeholder={t.ritualName}
                    className="w-full bg-purple-500/5 border border-purple-500/20 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-purple-500/50 transition-colors mb-2 text-purple-200"
                  />
                </motion.div>
              )}

              <div className="relative min-h-[150px]">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={t.inputPlaceholder}
                  className={`w-full h-full bg-white/5 border rounded-2xl p-5 text-sm resize-none focus:outline-none transition-colors placeholder:text-white/20 ${isRitualMode ? 'border-purple-500/30 focus:border-purple-500/50' : 'border-white/10 focus:border-orange-500/50'}`}
                />
                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={handleExtract}
                    disabled={isLoading || !inputText.trim()}
                    className={`flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl transition-all shadow-lg ${isRitualMode ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20' : 'bg-orange-500 hover:bg-orange-600 text-black shadow-orange-500/20'} disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="text-sm">{t.weaveBtn}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-500/70">{t.nodes}</span>
                </div>
                <div className="text-xl font-light">{graphData.nodes.length}</div>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] uppercase tracking-wider font-bold text-blue-500/70">{t.links}</span>
                </div>
                <div className="text-xl font-light">{graphData.links.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDownload}
                disabled={graphData.nodes.length === 0}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 text-white/80 py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold"
              >
                <FileJson className="w-3.5 h-3.5" />
                {t.downloadJson.split(' ')[1]}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={graphData.nodes.length === 0}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 text-white/80 py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleExportPNG}
                disabled={graphData.nodes.length === 0}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 text-white/80 py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                PNG
              </button>
              <label className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer text-white/80 py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold">
                <Upload className="w-3.5 h-3.5" />
                {t.importJsons.split(' ')[0]}
                <input type="file" multiple accept=".json" onChange={handleImportJsons} className="hidden" />
              </label>
              <button
                onClick={reorganizeGraph}
                disabled={graphData.nodes.length === 0 || isLoading}
                className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-30 text-emerald-400 py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                {t.updateWeb.split(' ')[0]}
              </button>
              <button
                onClick={handleResetWeb}
                className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 py-2.5 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold col-span-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.resetWeb}
              </button>
            </div>

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 py-3 rounded-xl transition-all text-sm font-medium"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              {t.syncCloud}
            </button>

            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-sm font-medium border ${showAnalytics ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
            >
              <Activity className="w-4 h-4" />
              {t.analytics}
            </button>

            <button
              onClick={handleClear}
              disabled={graphData.nodes.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 disabled:opacity-30 text-rose-500 py-3 rounded-xl transition-all text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              {t.clearTooltip}
            </button>
          </div>

          <footer className="text-[10px] text-white/30 flex items-center gap-4 border-t border-white/5 pt-4 mt-auto">
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              <span>Gemini 3.1 AI Extraction</span>
            </div>
            <span>© 2026 Esoteric AI</span>
          </footer>
        </div>

        {/* Right Column: Visualization */}
        <div className="flex-1 relative flex flex-col lg:flex-row min-h-[400px] lg:min-h-0 gap-4 w-full h-full">
          <div className="flex-1 relative w-full h-full">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="absolute top-4 right-4 z-40 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all group"
              title={isExpanded ? t.shrink : t.expand}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {graphData.nodes.length > 0 ? (
              <>
                <GraphVisualization 
                  data={graphData} 
                  onNodeClick={handleNodeClick}
                  onLinkClick={handleLinkClick}
                  searchQuery={searchQuery}
                  visibleTypes={activeVisibleTypes}
                  selectedNodeId={selectedNode?.id}
                  showFlows={showFlows}
                  flowSpeed={flowSpeed}
                  flowIntensity={flowIntensity}
                  flowThickness={flowThickness}
                  hideWeakFlows={hideWeakFlows}
                  isExpanded={isExpanded}
                />
                
                {/* Analytics Sidebar */}
                <AnimatePresence>
                  {showAnalytics && (
                    <motion.div
                      initial={{ x: 400, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 400, opacity: 0 }}
                      className="absolute top-0 right-0 bottom-0 w-full max-w-[320px] z-30"
                    >
                      <AnalyticsPanel 
                        data={graphData} 
                        lang={lang}
                        onNodeSelect={(node) => {
                          setSelectedNode(node);
                          setSelectedLink(null);
                        }} 
                      />
                      <button 
                        onClick={() => setShowAnalytics(false)}
                        className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/40 hover:text-white transition-colors z-40"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Node/Ritual Details Modal/Panel */}
                <AnimatePresence>
                  {selectedNode && (
                    <>
                      {/* Overlay for Ritual Modal */}
                      {selectedNode.type === 'ritual' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedNode(null)}
                          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />
                      )}

                      <motion.div
                        initial={selectedNode.type === 'ritual' ? { opacity: 0, scale: 0.9, y: 20 } : { x: 300, opacity: 0 }}
                        animate={selectedNode.type === 'ritual' ? { opacity: 1, scale: 1, y: 0 } : { x: 0, opacity: 1 }}
                        exit={selectedNode.type === 'ritual' ? { opacity: 0, scale: 0.9, y: 20 } : { x: 300, opacity: 0 }}
                        className={`
                          ${selectedNode.type === 'ritual' 
                            ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[500px] max-h-[80vh] overflow-y-auto z-50' 
                            : 'absolute top-4 right-4 w-full max-w-[280px] z-20'
                          } 
                          bg-[#151619]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl custom-scrollbar
                        `}
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#151619]/5 backdrop-blur-md py-1 z-10">
                            <div className="flex items-center gap-2">
                              <Fingerprint className="w-4 h-4 text-orange-500" />
                              <span className="text-[9px] uppercase tracking-widest font-bold text-white/40">{t.entityDetails}</span>
                            </div>
                            <button onClick={() => setSelectedNode(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <Tag className="w-3 h-3 text-white/30" />
                                <span className="text-[9px] uppercase tracking-wider font-bold text-white/30">{t.name}</span>
                              </div>
                              <h2 className="text-xl font-serif font-light text-white">{selectedNode.name}</h2>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <Layers className="w-3 h-3 text-white/30" />
                                <span className="text-[9px] uppercase tracking-wider font-bold text-white/30">{t.type}</span>
                              </div>
                              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${colors[selectedNode.type]}`}>
                                {selectedNode.type}
                              </div>
                            </div>

                            {selectedNode.description && (
                              <div className="pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                  <Sparkles className="w-3 h-3 text-purple-400" />
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-white/30">{t.ritualText}</span>
                                </div>
                                <div className="mb-4">
                                  <p className="text-sm text-white/70 leading-relaxed font-serif italic whitespace-pre-wrap">
                                    {selectedNode.description}
                                  </p>
                                </div>

                                {/* Connected Entities for Ritual */}
                                {selectedNode.type === 'ritual' && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                      <LinkIcon className="w-3 h-3 text-blue-400" />
                                      <span className="text-[9px] uppercase tracking-wider font-bold text-white/30">{t.connection}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {graphData.links
                                        .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                                        .map(l => {
                                          const otherId = l.source === selectedNode.id ? l.target : l.source;
                                          const otherNode = graphData.nodes.find(n => n.id === otherId);
                                          if (!otherNode) return null;
                                          return (
                                            <button
                                              key={otherId}
                                              onClick={() => setSelectedNode(otherNode)}
                                              className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-all hover:scale-105 ${colors[otherNode.type]}`}
                                            >
                                              {otherNode.name}
                                            </button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="pt-4 border-t border-white/5 flex flex-wrap gap-2">
                              <code className="text-[9px] font-mono bg-black/40 px-2 py-1 rounded text-orange-500/60">ID: {selectedNode.id}</code>
                              {selectedNode.type === 'ritual' && (
                                <button
                                  onClick={() => handleExportRitual(selectedNode)}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded text-[9px] font-bold uppercase tracking-wider text-purple-400 transition-all"
                                >
                                  <Download className="w-3 h-3" />
                                  {t.exportRitual.split(' ')[1]}
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => setSelectedNode(null)}
                              className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-white/60 transition-all mt-4"
                            >
                              {t.close}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Link Details Panel */}
                <AnimatePresence>
                  {selectedLink && (
                    <motion.div
                      initial={{ x: 300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 300, opacity: 0 }}
                      className="absolute top-4 right-4 w-full max-w-[280px] bg-[#151619]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-20"
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-blue-500" />
                            <span className="text-[9px] uppercase tracking-widest font-bold text-white/40">{t.relationDetails}</span>
                          </div>
                          <button onClick={() => setSelectedLink(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-5">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-white/30">{t.connection}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-white/60">{selectedLink.source as string}</span>
                              <span className="text-blue-400">→</span>
                              <span className="text-white/60">{selectedLink.target as string}</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-white/30">{t.nature}</span>
                            </div>
                            <div className="text-lg font-serif italic text-blue-200">
                              {selectedLink.relation.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <Database className="w-8 h-8 text-white/20" />
                </div>
                <h3 className="text-xl font-serif font-light mb-2">{t.emptyTitle}</h3>
                <p className="text-sm text-white/40 max-w-xs text-center px-6">
                  {t.emptyDesc}
                </p>
              </div>
            )}
          </div>

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 right-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-emerald-200 text-sm flex items-center gap-3 backdrop-blur-md z-30"
            >
              <Sparkles className="w-4 h-4" />
              {successMsg}
              <button onClick={() => setSuccessMsg(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 right-4 p-4 bg-rose-500/20 border border-rose-500/50 rounded-2xl text-rose-200 text-sm flex items-center gap-3 backdrop-blur-md z-30"
            >
              <Info className="w-4 h-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
