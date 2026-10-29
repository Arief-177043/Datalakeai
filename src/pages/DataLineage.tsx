import { useState, useRef, useMemo } from 'react';
import { api } from '@/services/api';
import type { LineageNode, LineageEdge, Dataset } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Workflow, Database, Download, Cpu, ShieldCheck, HardDrive,
  GitBranch, Brain, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';

const NODE_ICONS: Record<LineageNode['type'], typeof Database> = {
  source: Database,
  ingestion: Download,
  processing: Cpu,
  validation: ShieldCheck,
  storage: HardDrive,
  version: GitBranch,
  training: Brain,
};

const NODE_COLORS: Record<LineageNode['type'], string> = {
  source: 'hsl(var(--chart-1))',
  ingestion: 'hsl(var(--chart-3))',
  processing: 'hsl(var(--chart-5))',
  validation: 'hsl(var(--chart-2))',
  storage: 'hsl(var(--chart-1))',
  version: 'hsl(var(--chart-3))',
  training: 'hsl(var(--chart-4))',
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

export function DataLineage() {
  const { data: datasets, loading: dsLoading } = useAsync(() => api.getDatasets());
  const [selectedDsId, setSelectedDsId] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const effectiveDsId = selectedDsId || datasets?.[0]?.id || '';
  const { data: lineage, loading, error, refetch } = useAsync(
    () => effectiveDsId ? api.getLineage(effectiveDsId) : Promise.resolve({ nodes: [], edges: [] }),
    [effectiveDsId],
  );

  const nodes = lineage?.nodes ?? [];
  const edges = lineage?.edges ?? [];

  const connectedEdges = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    edges.forEach((e) => {
      if (e.from === hoveredNode || e.to === hoveredNode) connected.add(e.id);
    });
    return connected;
  }, [edges, hoveredNode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  };
  const handleMouseUp = () => setIsPanning(false);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  if (dsLoading || loading) return <LoadingState message="Loading lineage graph..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Data Lineage"
        description="Trace data flow from source through processing to AI training"
        icon={<Workflow className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Select value={effectiveDsId} onValueChange={setSelectedDsId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select dataset" /></SelectTrigger>
              <SelectContent>
                {datasets?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs">
            <span className="h-3 w-3 rounded" style={{ background: color }} />
            <span className="capitalize text-muted-foreground">{type}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {nodes.length === 0 ? (
            <EmptyState icon={<Workflow className="h-7 w-7" />} title="No lineage data" description="Select a dataset to view its data lineage graph." />
          ) : (
            <div className="relative" style={{ height: '550px' }}>
              {/* Zoom controls */}
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border bg-card/80 p-1 backdrop-blur">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView}><Maximize2 className="h-4 w-4" /></Button>
                <span className="text-center text-[10px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>

              <svg
                ref={svgRef}
                className="h-full w-full cursor-grab"
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {edges.map((edge) => {
                    const from = nodes.find((n) => n.id === edge.from);
                    const to = nodes.find((n) => n.id === edge.to);
                    if (!from || !to) return null;
                    const x1 = from.x + NODE_WIDTH;
                    const y1 = from.y + NODE_HEIGHT / 2;
                    const x2 = to.x;
                    const y2 = to.y + NODE_HEIGHT / 2;
                    const midX = (x1 + x2) / 2;
                    const isHighlighted = connectedEdges.has(edge.id);
                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                          strokeWidth={isHighlighted ? 2.5 : 1.5}
                          className="transition-all"
                        />
                        {edge.label && (
                          <text x={midX} y={(y1 + y2) / 2 - 5} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                            {edge.label}
                          </text>
                        )}
                        {/* Arrow */}
                        <polygon
                          points={`${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4} ${x2},${y2}`}
                          fill={isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                        />
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {nodes.map((node) => {
                    const Icon = NODE_ICONS[node.type];
                    const color = NODE_COLORS[node.type];
                    const isSelected = selectedNode?.id === node.id;
                    const isHovered = hoveredNode === node.id;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer"
                        onClick={() => setSelectedNode(node)}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                        <rect
                          width={NODE_WIDTH}
                          height={NODE_HEIGHT}
                          rx={10}
                          fill="hsl(var(--card))"
                          stroke={isSelected || isHovered ? color : 'hsl(var(--border))'}
                          strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                          className="transition-all"
                          filter={isSelected || isHovered ? 'brightness(1.1)' : 'none'}
                        />
                        <rect width={4} height={NODE_HEIGHT} rx={2} fill={color} />
                        <g transform={`translate(14, ${NODE_HEIGHT / 2 - 12})`}>
                          <Icon size={24} color={color} />
                        </g>
                        <text x={46} y={26} className="fill-foreground text-xs font-semibold">
                          {node.label.length > 18 ? node.label.slice(0, 18) + '...' : node.label}
                        </text>
                        <text x={46} y={44} className="fill-muted-foreground text-[10px] uppercase">
                          {node.type}
                        </text>
                        <circle cx={NODE_WIDTH - 14} cy={14} r={4} fill={node.status === 'active' ? 'hsl(var(--success))' : node.status === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'} className={node.status === 'active' ? 'animate-pulse' : ''} />
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Node detail panel */}
      {selectedNode && (
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: NODE_COLORS[selectedNode.type] + '20', color: NODE_COLORS[selectedNode.type] }}>
                {(() => { const Icon = NODE_ICONS[selectedNode.type]; return <Icon className="h-5 w-5" />; })()}
              </div>
              <div>
                <CardTitle className="text-base">{selectedNode.label}</CardTitle>
                <p className="text-xs text-muted-foreground capitalize">{selectedNode.type} node</p>
              </div>
            </div>
            <StatusBadge status={selectedNode.status} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(selectedNode.metadata).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="text-sm font-mono text-muted-foreground">{key}</span>
                  <span className="text-sm font-medium">{val}</span>
                </div>
              ))}
            </div>
            {/* Connected nodes */}
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Connections</p>
              <div className="flex flex-wrap gap-2">
                {edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).map((e) => {
                  const otherId = e.from === selectedNode.id ? e.to : e.from;
                  const other = nodes.find((n) => n.id === otherId);
                  const direction = e.from === selectedNode.id ? '→' : '←';
                  return other ? <Badge key={e.id} variant="secondary" className="gap-1">{direction} {other.label}</Badge> : null;
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
