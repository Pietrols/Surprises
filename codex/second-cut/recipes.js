// All sizes are tenths of a millimeter. Each option is a separate build.
export function enumerateRecipes(stocks,settings) {
  const groups = new Map(stocks.map(s => [JSON.stringify([s.material,s.thickness]),s]));
  const out = [];
  for (const s of groups.values()) {
    const t = s.thickness;
    for (const [family,W,D,H] of [
      ['tray',2400,1600,600], ['tray',1800,1200,500],
      ['divider-box',2400,1600,800], ['divider-box',2000,1400,700],
      ['tile-set',800,800,t], ['tile-set',1000,1000,t]
    ]) {
      const tiles = family === 'tile-set', divider = family === 'divider-box';
      const requiredTools = tiles ? ['saw','sandpaper'] : ['saw','clamps','glue','sandpaper'];
      if (!requiredTools.every(v => settings.tools.includes(v))) continue;
      // Prototype joints assume 6–12 mm glue-compatible plywood or MDF.
      if (!tiles && (!['plywood','mdf'].includes(s.material.toLowerCase()) || t<60 || t>120)) continue;
      for (const quantity of [1,2]) {
        const parts = [];
        for (let i=1;i<=quantity;i++) {
          const add=(label,w,h,grain='any')=>parts.push({id:i+'-'+(parts.length+1),label,width:w,height:h,grain});
          if (tiles) {
            for(let j=0;j<4;j++) add('Square tile',W,D);
          } else {
            add('Inset floor',W-2*t,D-2*t);
            for(let j=0;j<2;j++) add('Long wall',W,H,'x');
            for(let j=0;j<2;j++) add('End wall',D-2*t,H,'x');
            if(divider) add('Center divider',D-2*t,H-t,'x');
          }
        }
        out.push({id:JSON.stringify([family,1,W,D,H,quantity,s.material,t]),recipeId:family,recipeVersion:1,
          title:tiles?'Four square tiles':divider?'Two-compartment box':'Desk sorting tray',
          description:tiles?'A matched set of four flat pieces.':'Inset floor, with end walls between the long walls.',
          width:W,depth:D,height:H,quantity,thickness:t,material:s.material,parts,requiredTools,
          instructions:tiles?['Check cut dimensions and sand the edges.']:[
            'Dry-fit the floor between all four walls with its underside flush to the wall bottoms.',
            'Fit the end walls between the long walls. Check squareness and actual material thickness.',
            ...(divider?['Center the divider on top of the inset floor, spanning between the long walls.']:[]),
            'Check joint fit, then glue and clamp per the adhesive instructions. Sand exposed edges.'
          ],searchNote:'Bounded guillotine search. Alternatives use the same inventory.'});
      }
    }
  }
  return out;
}
