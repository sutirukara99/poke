/*
 * Semantic overworld tileset catalog.
 *
 * Terrain and collision logic refer to semantic IDs only. A tileset can later
 * swap procedural terrain for a reconstructed metatile atlas without changing
 * the generator or reducer.
 */
const QowTilesetCatalog={
  "pokeregions-gba":{
    id:"pokeregions-gba",
    tileSize:16,
    image:null,
    renderMode:"procedural",
    tiles:{
      wall:{id:"wall",spriteX:null,spriteY:null,walkable:!1,terrain:"wall",layer:"ground"},
      ground:{id:"ground",spriteX:null,spriteY:null,walkable:!0,terrain:"ground",layer:"ground"},
      path:{id:"path",spriteX:null,spriteY:null,walkable:!0,terrain:"path",layer:"ground"},
      grass:{id:"grass",spriteX:null,spriteY:null,walkable:!0,encounterZone:!0,terrain:"grass",layer:"ground"},
      flower:{id:"flower",spriteX:null,spriteY:null,walkable:!0,terrain:"grass",layer:"ground"},
      sand:{id:"sand",spriteX:null,spriteY:null,walkable:!0,terrain:"sand",layer:"ground"},
      snow:{id:"snow",spriteX:null,spriteY:null,walkable:!0,terrain:"snow",layer:"ground"},
      ruin:{id:"ruin",spriteX:null,spriteY:null,walkable:!0,terrain:"ruin",layer:"ground"},
      bossfloor:{id:"bossfloor",spriteX:null,spriteY:null,walkable:!0,terrain:"special",layer:"ground"},
      water:{id:"water",spriteX:null,spriteY:null,walkable:!1,terrain:"water",layer:"ground"},
      rock:{id:"rock",spriteX:null,spriteY:null,walkable:!1,terrain:"rock",layer:"object"},
      tree:{id:"tree",spriteX:null,spriteY:null,walkable:!1,terrain:"tree",layer:"object"},
      lava:{id:"lava",spriteX:null,spriteY:null,walkable:!1,terrain:"lava",layer:"ground"}
    },
    objects:{
      player:"/ui/overworld/frlg/red-normal.png",
      youngster:"/ui/overworld/frlg/youngster.png",
      hiker:"/ui/overworld/frlg/hiker.png",
      nurse:"/ui/overworld/frlg/nurse.png",
      itemBall:"/ui/overworld/frlg/item-ball.png",
      sign:"/ui/overworld/frlg/sign.png",
      gymSign:"/ui/overworld/frlg/gym-sign.png",
      rock:"/ui/overworld/frlg/rock.png"
    }
  }
};
const QowActiveTileset=QowTilesetCatalog["pokeregions-gba"];
const QowTileDefs=QowActiveTileset.tiles;
