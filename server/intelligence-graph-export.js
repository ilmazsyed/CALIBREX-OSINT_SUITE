const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function renderInvestigationGraphMl(graph={}) {
 const nodes=Array.isArray(graph.nodes)?graph.nodes:[];
 const edges=Array.isArray(graph.edges)?graph.edges:[];
 const nodeIds=new Set(nodes.map(x=>String(x.id)));
 const nodeXml=nodes.map(node=>{
  const data={label:node.label,type:node.type,entityType:node.entityType,resolution:node.resolution,assessment:node.assessment,evidenceType:node.evidenceType,source:node.source,url:node.url,sourceEvidenceIds:node.sourceEvidenceIds};
  return '<node id="'+esc(node.id)+'">'+Object.entries(data).filter(([,v])=>v!=null).map(([k,v])=>'<data key="'+k+'">'+esc(Array.isArray(v)?v.join(','):v)+'</data>').join('')+'</node>';
 }).join('');
 const edgeXml=edges.filter(edge=>nodeIds.has(String(edge.source))&&nodeIds.has(String(edge.target))).map(edge=>{
  const data={type:edge.type,status:edge.status,assessment:edge.assessment,direction:edge.direction,confidence:edge.confidence,validFrom:edge.validFrom,validUntil:edge.validUntil,reviewRequired:edge.reviewRequired,provenanceComplete:edge.provenanceComplete,sourceEvidenceIds:edge.sourceEvidenceIds,rationale:edge.rationale};
  return '<edge id="'+esc(edge.id)+'" source="'+esc(edge.source)+'" target="'+esc(edge.target)+'">'+Object.entries(data).filter(([,v])=>v!=null).map(([k,v])=>'<data key="'+k+'">'+esc(Array.isArray(v)?v.join(','):v)+'</data>').join('')+'</edge>';
 }).join('');
 const keys=[['label','node','string'],['type','all','string'],['entityType','node','string'],['resolution','node','string'],['assessment','all','string'],['evidenceType','node','string'],['source','node','string'],['url','node','string'],['sourceEvidenceIds','all','string'],['status','edge','string'],['direction','edge','string'],['confidence','edge','double'],['validFrom','edge','string'],['validUntil','edge','string'],['reviewRequired','edge','boolean'],['provenanceComplete','edge','boolean'],['rationale','edge','string']];
 return '<?xml version="1.0" encoding="UTF-8"?>'+
  '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">'+keys.map(([id,forType,type])=>'<key id="'+id+'" for="'+forType+'" attr.name="'+id+'" attr.type="'+type+'"/>').join('')+
  '<graph id="CalibrexInvestigation" edgedefault="directed">'+nodeXml+edgeXml+'</graph></graphml>';
}
