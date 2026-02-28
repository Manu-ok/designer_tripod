/**
 * BUILDING GRAPH DATA MODEL
 * Derived from Multi-Floor_Building_Layout SVG
 * Floors: B1 (Basement), GF (Ground), F1, F2, F3
 */

const FLOORS = {
  B1: { label: 'Basement (B1)', color: '#1a1a2e', order: 0 },
  GF: { label: 'Ground Floor', color: '#16213e', order: 1 },
  F1: { label: 'Floor 1',       color: '#0f3460', order: 2 },
  F2: { label: 'Floor 2',       color: '#1a1a4e', order: 3 },
  F3: { label: 'Floor 3',       color: '#0d2137', order: 4 },
};

// Node definitions: id, label, floor, type
const NODES = {
  // ── BASEMENT ──────────────────────────────────────────────
  Parking:       { label: 'Parking',         floor: 'B1', type: 'room' },
  Electrical:    { label: 'Electrical Room',  floor: 'B1', type: 'room' },
  Generator:     { label: 'Generator Room',   floor: 'B1', type: 'room' },
  StairB:        { label: 'Stairwell B',      floor: 'B1', type: 'stair' },
  EmergencyExit: { label: 'Emergency Exit',   floor: 'B1', type: 'exit' },

  // ── GROUND FLOOR ──────────────────────────────────────────
  Entrance:  { label: 'Entrance',      floor: 'GF', type: 'room' },
  Reception: { label: 'Reception',     floor: 'GF', type: 'room' },
  Hall:      { label: 'Main Hall',     floor: 'GF', type: 'corridor' },
  Control:   { label: 'Control Room',  floor: 'GF', type: 'control' },  // START
  KitchenG:  { label: 'Kitchen (GF)',  floor: 'GF', type: 'room' },
  WashG:     { label: 'Washroom (GF)', floor: 'GF', type: 'room' },
  StairG:    { label: 'Stairwell G',   floor: 'GF', type: 'stair' },
  ExitA:     { label: 'Exit A',        floor: 'GF', type: 'exit' },
  ExitB:     { label: 'Exit B',        floor: 'GF', type: 'exit' },

  // ── FLOOR 1 ───────────────────────────────────────────────
  Lobby1:  { label: 'Lobby 1',         floor: 'F1', type: 'corridor' },
  R101:    { label: 'Room 101',         floor: 'F1', type: 'room' },
  R102:    { label: 'Room 102',         floor: 'F1', type: 'room' },
  Office:  { label: 'Office',           floor: 'F1', type: 'room' },
  Wash1:   { label: 'Washroom (F1)',    floor: 'F1', type: 'room' },
  Storage: { label: 'Storage',          floor: 'F1', type: 'room' },
  Stair1:  { label: 'Stairwell 1',      floor: 'F1', type: 'stair' },

  // ── FLOOR 2 ───────────────────────────────────────────────
  Lobby2:   { label: 'Lobby 2',         floor: 'F2', type: 'corridor' },
  R201:     { label: 'Room 201',         floor: 'F2', type: 'room' },
  R202:     { label: 'Room 202',         floor: 'F2', type: 'room' },
  Kitchen2: { label: 'Kitchen (F2)',     floor: 'F2', type: 'room' },
  Wash2:    { label: 'Washroom (F2)',    floor: 'F2', type: 'room' },
  Server:   { label: 'Server Room',      floor: 'F2', type: 'room' },
  Stair2:   { label: 'Stairwell 2',      floor: 'F2', type: 'stair' },

  // ── FLOOR 3 ───────────────────────────────────────────────
  Lobby3:   { label: 'Lobby 3',         floor: 'F3', type: 'corridor' },
  R301:     { label: 'Room 301',         floor: 'F3', type: 'room' },
  R302:     { label: 'Room 302',         floor: 'F3', type: 'room' },
  R303:     { label: 'Room 303',         floor: 'F3', type: 'room' },
  Wash3:    { label: 'Washroom (F3)',    floor: 'F3', type: 'room' },
  Balcony3: { label: 'Balcony',          floor: 'F3', type: 'room' },
  Stair3:   { label: 'Stairwell 3',      floor: 'F3', type: 'stair' },
};

// Adjacency list (bidirectional connections derived from SVG edges)
const ADJACENCY = {
  // BASEMENT
  Parking:       ['Electrical', 'Generator', 'StairB', 'EmergencyExit'],
  Electrical:    ['Parking'],
  Generator:     ['Parking'],
  StairB:        ['Parking', 'StairG'],           // cross-floor
  EmergencyExit: ['Parking'],

  // GROUND FLOOR
  Entrance:  ['Reception'],
  Reception: ['Entrance', 'Hall'],
  Hall:      ['Reception', 'Control', 'KitchenG', 'WashG', 'StairG', 'ExitA', 'ExitB'],
  Control:   ['Hall'],
  KitchenG:  ['Hall'],
  WashG:     ['Hall'],
  StairG:    ['Hall', 'Stair1', 'StairB'],        // cross-floor
  ExitA:     ['Hall'],
  ExitB:     ['Hall'],

  // FLOOR 1
  Lobby1:  ['R101', 'R102', 'Office', 'Wash1', 'Storage', 'Stair1'],
  R101:    ['Lobby1'],
  R102:    ['Lobby1'],
  Office:  ['Lobby1'],
  Wash1:   ['Lobby1'],
  Storage: ['Lobby1'],
  Stair1:  ['Lobby1', 'StairG', 'Stair2'],        // cross-floor

  // FLOOR 2
  Lobby2:   ['R201', 'R202', 'Kitchen2', 'Wash2', 'Server', 'Stair2'],
  R201:     ['Lobby2'],
  R202:     ['Lobby2'],
  Kitchen2: ['Lobby2'],
  Wash2:    ['Lobby2'],
  Server:   ['Lobby2'],
  Stair2:   ['Lobby2', 'Stair1', 'Stair3'],       // cross-floor

  // FLOOR 3
  Lobby3:   ['R301', 'R302', 'R303', 'Wash3', 'Balcony3', 'Stair3'],
  R301:     ['Lobby3'],
  R302:     ['Lobby3'],
  R303:     ['Lobby3'],
  Wash3:    ['Lobby3'],
  Balcony3: ['Lobby3'],
  Stair3:   ['Lobby3', 'Stair2'],                 // cross-floor
};

const EXITS = new Set(['ExitA', 'ExitB', 'EmergencyExit']);
const START_NODE = 'Control';

// Hazard presets for quick scenario testing
const HAZARD_PRESETS = {
  'Ground Floor Fire': {
    nodes: ['Hall', 'KitchenG'],
    edges: [],
    description: 'Fire in Main Hall and Kitchen blocks main ground floor corridor'
  },
  'Exit A Blocked': {
    nodes: ['ExitA'],
    edges: [],
    description: 'Exit A is sealed — forces route to alternate exit'
  },
  'Full Lockdown': {
    nodes: ['ExitA', 'ExitB', 'EmergencyExit'],
    edges: [],
    description: 'All exits blocked — evacuation impossible'
  },
  'Stairwell Fire': {
    nodes: ['StairG', 'Stair1'],
    edges: [],
    description: 'Stairwells G and 1 on fire — upper floors isolated'
  },
  'Smoke on F2': {
    nodes: ['Lobby2', 'Server', 'Kitchen2'],
    edges: [],
    description: 'Smoke fills Floor 2 corridor and adjacent rooms'
  },
};

// Export everything
if (typeof module !== 'undefined') {
  module.exports = { FLOORS, NODES, ADJACENCY, EXITS, START_NODE, HAZARD_PRESETS };
}
