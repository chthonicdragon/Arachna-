import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { GraphData, Node, Link } from '../services/geminiService';

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick?: (node: Node) => void;
  onLinkClick?: (link: Link) => void;
  searchQuery?: string;
  visibleTypes?: Set<string>;
  selectedNodeId?: string | null;
  showFlows?: boolean;
  flowSpeed?: number;
  flowIntensity?: number;
  flowThickness?: number;
  hideWeakFlows?: boolean;
  isExpanded?: boolean;
}

interface D3Node extends Node, d3.SimulationNodeDatum {
  degree?: number;
  isPowerCenter?: boolean;
  isKeyRitual?: boolean;
  influence?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  relation: string;
  weight?: number;
}

const COLORS: Record<string, string> = {
  deity: "#f43f5e", // rose-500
  spirit: "#a855f7", // purple-500
  ritual: "#3b82f6", // blue-500
  symbol: "#eab308", // yellow-500
  concept: "#10b981", // emerald-500
  place: "#f97316", // orange-500
  creature: "#06b6d4", // cyan-500
  artifact: "#8b5cf6", // violet-500
  spell: "#ec4899", // pink-500
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ 
  data, 
  onNodeClick, 
  onLinkClick,
  searchQuery = '',
  visibleTypes = new Set(['deity', 'spirit', 'ritual', 'symbol', 'concept', 'place', 'creature', 'artifact', 'spell']),
  selectedNodeId = null,
  showFlows = true,
  flowSpeed = 1,
  flowIntensity = 1,
  flowThickness = 1,
  hideWeakFlows = false,
  isExpanded = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodePositionsRef = useRef<Map<string, { x: number, y: number, vx: number, vy: number }>>(new Map());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [debouncedDimensions] = useDebounce(dimensions, 250);

  // Resize observer to handle container changes
  useEffect(() => {
    if (!svgRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    
    observer.observe(svgRef.current.parentElement!);
    return () => observer.disconnect();
  }, []);

  // Filter data based on visible types
  const filteredData = useMemo(() => {
    const nodes = data.nodes.filter(n => visibleTypes.has(n.type));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = data.links.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));
    
    // Calculate degrees for sizing
    const degrees: Record<string, number> = {};
    links.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
      degrees[s] = (degrees[s] || 0) + 1;
      degrees[t] = (degrees[t] || 0) + 1;
    });

    // Calculate influence (Power Centers)
    const influence: Record<string, number> = {};
    nodes.forEach(node => {
      let neighborDegreeSum = 0;
      links.forEach(link => {
        const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
        if (s === node.id) neighborDegreeSum += degrees[t] || 0;
        if (t === node.id) neighborDegreeSum += degrees[s] || 0;
      });
      influence[node.id] = (degrees[node.id] || 0) + (neighborDegreeSum * 0.5);
    });

    const sortedInfluence = Object.values(influence).sort((a, b) => b - a);
    const powerThreshold = sortedInfluence[Math.min(2, sortedInfluence.length - 1)] || Infinity;

    const sortedRituals = nodes.filter(n => n.type === 'ritual').sort((a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0));
    const ritualThreshold = sortedRituals[Math.min(2, sortedRituals.length - 1)]?.id ? (degrees[sortedRituals[Math.min(2, sortedRituals.length - 1)].id] || 0) : Infinity;

    return {
      nodes: nodes.map(n => ({ 
        ...n, 
        degree: degrees[n.id] || 0,
        influence: influence[n.id] || 0,
        isPowerCenter: influence[n.id] >= powerThreshold && influence[n.id] > 2,
        isKeyRitual: n.type === 'ritual' && (degrees[n.id] || 0) >= ritualThreshold && (degrees[n.id] || 0) > 1
      })),
      links: links.map(l => ({ ...l }))
    };
  }, [data, visibleTypes]);

  // Determine highlighted elements based on search OR click OR external selection
  const highlights = useMemo(() => {
    const highlightedNodeIds = new Set<string>();
    const highlightedLinkIds = new Set<string>();

    const activeId = selectedNodeId;

    // 1. Search Highlights
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchedNodes = filteredData.nodes.filter(n => n.name.toLowerCase().includes(query));

      matchedNodes.forEach(node => {
        highlightedNodeIds.add(node.id);
        filteredData.links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
          
          if (sourceId === node.id) {
            highlightedNodeIds.add(targetId);
            highlightedLinkIds.add(`${sourceId}-${targetId}-${link.relation}`);
          }
          if (targetId === node.id) {
            highlightedNodeIds.add(sourceId);
            highlightedLinkIds.add(`${sourceId}-${targetId}-${link.relation}`);
          }
        });
      });
    }

    // 2. Selection Highlights (Neighbors)
    if (activeId) {
      highlightedNodeIds.add(activeId);
      filteredData.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        
        if (sourceId === activeId) {
          highlightedNodeIds.add(targetId);
          highlightedLinkIds.add(`${sourceId}-${targetId}-${link.relation}`);
        }
        if (targetId === activeId) {
          highlightedNodeIds.add(sourceId);
          highlightedLinkIds.add(`${sourceId}-${targetId}-${link.relation}`);
        }
      });
    }

    return { nodes: highlightedNodeIds, links: highlightedLinkIds };
  }, [filteredData, searchQuery, selectedNodeId]);

  useEffect(() => {
    if (!svgRef.current || !filteredData.nodes.length) {
      d3.select(svgRef.current).selectAll("*").remove();
      return;
    }

    const { width, height } = debouncedDimensions;
    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .on("click", (event) => {
        if (event.target.tagName === 'svg') {
          if (onNodeClick) onNodeClick(null as any);
        }
      });

    // If simulation already exists and data is the same, just update forces and center
    if (simulationRef.current && simulationRef.current.nodes().length === filteredData.nodes.length) {
      simulationRef.current
        .force("x", d3.forceX(width / 2).strength(0.05))
        .force("y", d3.forceY(height / 2).strength(0.05))
        .alpha(0.3)
        .restart();
      return;
    }

    // Clear previous graph if data changed or first run
    svg.selectAll("*").remove();

    // Container for all graph elements to enable zoom/pan
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Clone data for D3 to mutate, preserving positions if available
    const nodes: D3Node[] = filteredData.nodes.map(d => {
      const pos = nodePositionsRef.current.get(d.id);
      return { 
        ...d, 
        x: pos?.x ?? width / 2 + (Math.random() - 0.5) * 100,
        y: pos?.y ?? height / 2 + (Math.random() - 0.5) * 100,
        vx: pos?.vx ?? 0,
        vy: pos?.vy ?? 0
      };
    });
    const links: D3Link[] = filteredData.links.map(d => ({ 
      source: d.source, 
      target: d.target, 
      relation: d.relation 
    }));

    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(160))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collision", d3.forceCollide<D3Node>().radius(d => 40 + (d.degree || 0) * 2.5));

    simulationRef.current = simulation;

    // Arrowhead marker
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 32)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#666")
      .style("stroke", "none");

    const getLinkColor = (d: D3Link) => {
      const source = d.source as D3Node;
      const target = d.target as D3Node;
      const id = `${source.id}-${target.id}-${d.relation}`;
      
      if (highlights.nodes.size > 0) {
        return highlights.links.has(id) ? "#f97316" : "#111";
      }

      // Systematic coloring based on connection types
      const typePair = [source.type, target.type].sort().join('-');
      const typeColors: Record<string, string> = {
        'deity-ritual': "#f43f5e", // rose
        'spirit-symbol': "#a855f7", // purple
        'ritual-spell': "#3b82f6", // blue
        'deity-spirit': "#ec4899", // pink
        'place-ritual': "#f97316", // orange
        'artifact-deity': "#eab308", // yellow
        'concept-deity': "#10b981", // emerald
      };
      
      return typeColors[typePair] || "#333";
    };

    const linkGroup = g.append("g")
      .attr("class", "links");

    const link = linkGroup.selectAll(".base-line")
      .data(links)
      .join("line")
      .attr("class", "base-line")
      .attr("stroke", d => getLinkColor(d))
      .attr("stroke-opacity", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const id = `${source.id}-${target.id}-${d.relation}`;
        if (highlights.nodes.size > 0) {
          return highlights.links.has(id) ? 0.8 : 0.03;
        }
        return 0.3;
      })
      .attr("stroke-width", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const id = `${source.id}-${target.id}-${d.relation}`;
        return highlights.links.has(id) ? 3 : 1;
      })
      .attr("marker-end", "url(#arrowhead)")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onLinkClick) {
          const originalLink = data.links.find(l => 
            (typeof l.source === 'string' ? l.source : (l.source as any).id) === (typeof d.source === 'string' ? d.source : (d.source as any).id) &&
            (typeof l.target === 'string' ? l.target : (l.target as any).id) === (typeof d.target === 'string' ? d.target : (d.target as any).id) &&
            l.relation === d.relation
          );
          if (originalLink) onLinkClick(originalLink);
        }
      });

    // Power Flows Animation
    const flow = linkGroup.selectAll(".flow-line")
      .data(showFlows ? links : [])
      .join("line")
      .attr("class", "flow-line")
      .attr("stroke", d => getLinkColor(d))
      .attr("stroke-width", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const isKey = source.isPowerCenter || target.isPowerCenter || source.isKeyRitual || target.isKeyRitual;
        const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
        const base = 1.5 * flowThickness;
        return (isKey ? base * 2 : base) * (isHovered ? 1.5 : 1);
      })
      .attr("stroke-dasharray", "4, 12")
      .attr("stroke-opacity", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const isKey = source.isPowerCenter || target.isPowerCenter || source.isKeyRitual || target.isKeyRitual;
        const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
        
        if (hideWeakFlows && !isKey && !isHovered) return 0;
        
        const id = `${source.id}-${target.id}-${d.relation}`;
        if (highlights.nodes.size > 0 && !highlights.links.has(id)) return 0;
        
        return (isKey ? 0.8 : 0.4) * flowIntensity * (isHovered ? 1.2 : 1);
      })
      .style("filter", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const isKey = source.isPowerCenter || target.isPowerCenter || source.isKeyRitual || target.isKeyRitual;
        return isKey ? `drop-shadow(0 0 3px ${getLinkColor(d)})` : "none";
      })
      .style("pointer-events", "none");

    // Add animation to flows
    flow.each(function(d) {
      const source = d.source as D3Node;
      const target = d.target as D3Node;
      const isKey = source.isPowerCenter || target.isPowerCenter || source.isKeyRitual || target.isKeyRitual;
      const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
      
      const speed = (isKey ? 2 : 1) * flowSpeed * (isHovered ? 1.5 : 1);
      const duration = 20 / speed; // seconds for one cycle

      d3.select(this)
        .append("animate")
        .attr("attributeName", "stroke-dashoffset")
        .attr("from", "16")
        .attr("to", "0")
        .attr("dur", `${duration}s`)
        .attr("repeatCount", "indefinite");
    });

    const linkText = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "9px")
      .attr("fill", "#888")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .attr("opacity", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const id = `${source.id}-${target.id}-${d.relation}`;
        if (highlights.nodes.size > 0) {
          return highlights.links.has(id) ? 1 : 0.02;
        }
        return 0.7;
      })
      .text(d => d.relation);

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")
      .attr("opacity", d => {
        if (highlights.nodes.size > 0) {
          return highlights.nodes.has(d.id) ? 1 : 0.1;
        }
        return 1;
      })
      .on("mouseenter", (event, d) => {
        setHoveredNodeId(d.id);
      })
      .on("mouseleave", () => {
        setHoveredNodeId(null);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        // Remove defaultPrevented check to be more permissive with clicks
        if (onNodeClick) {
          const originalNode = data.nodes.find(n => n.id === d.id);
          if (originalNode) onNodeClick(originalNode);
        }
      })
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", d => 12 + (d.degree || 0) * 2.5) // More pronounced degree-based sizing
      .attr("fill", d => COLORS[d.type] || "#999")
      .attr("stroke", d => {
        if (highlights.nodes.has(d.id)) return "#fff";
        if (d.isPowerCenter) return "rgba(255, 255, 255, 0.8)";
        if (d.isKeyRitual) return "rgba(168, 85, 247, 0.8)";
        return "rgba(255,255,255,0.3)";
      })
      .attr("stroke-width", d => {
        if (highlights.nodes.has(d.id)) return 4;
        if (d.isPowerCenter || d.isKeyRitual) return 3;
        return 2;
      })
      .attr("class", d => `transition-all duration-300 ${d.isKeyRitual ? 'animate-pulse' : ''}`)
      .style("filter", d => {
        if (highlights.nodes.has(d.id)) return `drop-shadow(0 0 12px ${COLORS[d.type]})`;
        if (d.isPowerCenter) return `drop-shadow(0 0 8px ${COLORS[d.type]}88)`;
        if (d.isKeyRitual) return `drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))`;
        return "none";
      });

    node.append("text")
      .attr("x", d => 16 + (d.degree || 0) * 2.5)
      .attr("y", 4)
      .attr("fill", "#eee")
      .attr("font-size", d => (14 + (d.degree || 0) * 0.8) + "px")
      .attr("font-weight", d => highlights.nodes.has(d.id) ? "800" : "500")
      .attr("paint-order", "stroke")
      .attr("stroke", "#000")
      .attr("stroke-width", "4px")
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .text(d => d.name);

    simulation.on("tick", () => {
      // Store positions for next restart
      nodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          nodePositionsRef.current.set(n.id, { x: n.x, y: n.y, vx: n.vx || 0, vy: n.vy || 0 });
        }
      });

      link
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      flow
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      linkText
        .attr("x", d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr("y", d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, [filteredData, data.links, data.nodes, onLinkClick, onNodeClick, debouncedDimensions]);

  // Update styles for highlights and hover without restarting simulation
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Update nodes
    svg.selectAll<SVGGElement, D3Node>("g.node-group")
      .attr("opacity", d => {
        if (highlights.nodes.size > 0) {
          return highlights.nodes.has(d.id) ? 1 : 0.1;
        }
        return 1;
      });

    svg.selectAll<SVGCircleElement, D3Node>("g.node-group circle")
      .attr("stroke", d => {
        if (highlights.nodes.has(d.id)) return "#fff";
        if (d.isPowerCenter) return "rgba(255, 255, 255, 0.8)";
        if (d.isKeyRitual) return "rgba(168, 85, 247, 0.8)";
        return "rgba(255,255,255,0.3)";
      })
      .attr("stroke-width", d => {
        if (highlights.nodes.has(d.id)) return 4;
        if (d.isPowerCenter || d.isKeyRitual) return 3;
        return 2;
      })
      .style("filter", d => {
        if (highlights.nodes.has(d.id)) return `drop-shadow(0 0 12px ${COLORS[d.type]})`;
        if (d.isPowerCenter) return `drop-shadow(0 0 8px ${COLORS[d.type]}88)`;
        if (d.isKeyRitual) return `drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))`;
        return "none";
      });

    svg.selectAll<SVGTextElement, D3Node>("g.node-group text")
      .attr("font-weight", d => highlights.nodes.has(d.id) ? "800" : "500");

    // Update links
    svg.selectAll<SVGLineElement, D3Link>(".base-line")
      .attr("stroke-opacity", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const id = `${source.id}-${target.id}-${d.relation}`;
        if (highlights.nodes.size > 0) {
          return highlights.links.has(id) ? 0.8 : 0.03;
        }
        return 0.3;
      })
      .attr("stroke-width", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const id = `${source.id}-${target.id}-${d.relation}`;
        return highlights.links.has(id) ? 3 : 1;
      });

    // Update flows
    svg.selectAll<SVGLineElement, D3Link>(".flow-line")
      .attr("stroke-width", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const isKey = source.isPowerCenter || target.isPowerCenter || source.isKeyRitual || target.isKeyRitual;
        const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
        const base = 1.5 * flowThickness;
        return (isKey ? base * 2 : base) * (isHovered ? 1.5 : 1);
      })
      .attr("stroke-opacity", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        const isKey = source.isPowerCenter || target.isPowerCenter || source.isKeyRitual || target.isKeyRitual;
        const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
        
        if (hideWeakFlows && !isKey && !isHovered) return 0;
        
        const id = `${source.id}-${target.id}-${d.relation}`;
        if (highlights.nodes.size > 0 && !highlights.links.has(id)) return 0;
        
        return (isKey ? 0.8 : 0.4) * flowIntensity * (isHovered ? 1.2 : 1);
      });

  }, [highlights, hoveredNodeId, flowIntensity, flowThickness, hideWeakFlows]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.75);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div className="w-full h-full bg-black/40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl backdrop-blur-sm relative">
      <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
        <button 
          onClick={handleZoomIn}
          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button 
          onClick={handleReset}
          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70"
          title="Reset Zoom"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
      <svg id="main-graph-svg" ref={svgRef} className="w-full h-full touch-none" />
    </div>
  );
};

export default GraphVisualization;
