// The course catalogue. The menu reads this without loading any lesson code; a lesson's module
// is imported the first time it is opened (`./<subject>/<id>.js`, default export, see README).

export const SUBJECTS = [
  { id: 'science', letter: 'S', name: 'Science', blurb: 'Chemistry, biology, anatomy and physics you can turn in your hands.' },
  { id: 'technology', letter: 'T', name: 'Technology', blurb: 'How computers think, store colour, move data and train AI.' },
  { id: 'engineering', letter: 'E', name: 'Engineering', blurb: 'Forces, machines and mechanisms, taken apart.' },
  { id: 'math', letter: 'M', name: 'Math', blurb: 'Functions, trigonometry, calculus and linear algebra in real depth.' },
];

export const LESSONS = [
  { id: 'atom', subject: 'science', title: 'Atoms & Electron Shells', topic: 'Chemistry', summary: 'Build the first 18 elements: protons, neutrons, shells, valence electrons, ions and isotopes, then see real orbital shapes.' },
  { id: 'dna', subject: 'science', title: 'DNA & Replication', topic: 'Biology', summary: 'Spin the double helix, pair the bases, and unzip it to watch semi-conservative replication.' },
  { id: 'projectile', subject: 'science', title: 'Projectile Motion', topic: 'Physics', summary: 'Launch at any angle and speed on Earth, the Moon or Mars, with velocity vectors and the range equation.' },
  { id: 'heart', subject: 'science', title: 'The Heart & Blood Flow', topic: 'Anatomy', summary: 'Watch a beating four-chamber heart push blood through the lungs and the body, with valves, an ECG trace and cardiac output.' },

  { id: 'logic', subject: 'technology', title: 'Logic Gates & Adders', topic: 'Computer Science', summary: 'Flip input bits and watch signals flow through AND, OR, XOR and NOT gates into a working binary adder.' },
  { id: 'network', subject: 'technology', title: 'Packets & Routing', topic: 'Networks', summary: 'Send packets across a network, find the shortest path with Dijkstra, and cut a link to see it reroute.' },
  { id: 'pixels', subject: 'technology', title: 'Pixels, Colour & Bits', topic: 'Digital Media', summary: 'Mix red, green and blue light inside the RGB colour cube and see how many bits a colour needs.' },
  { id: 'datacenter', subject: 'technology', title: 'Data Centers & AI', topic: 'Computing', summary: 'Walk a GPU data hall: racks, hot and cold aisles, liquid cooling and power, and estimate what it takes to train an AI model.' },

  { id: 'bridge', subject: 'engineering', title: 'Truss Bridges & Forces', topic: 'Structures', summary: 'Load a truss bridge and see every member go into tension or compression, solved by the method of joints.' },
  { id: 'engine', subject: 'engineering', title: 'The Four-Stroke Engine', topic: 'Mechanical', summary: 'Intake, compression, power, exhaust: a cutaway engine with moving valves, crankshaft and spark.' },
  { id: 'gears', subject: 'engineering', title: 'Gears & Mechanical Advantage', topic: 'Machines', summary: 'Mesh gears of different sizes and trade speed for torque, with live ratios and RPM.' },
  { id: 'differential', subject: 'engineering', title: 'The Car Differential', topic: 'Mechanical', summary: 'See how a differential lets the outside wheel spin faster in a turn, with the ring gear, pinion and spider gears in motion.' },

  { id: 'surfaces', subject: 'math', title: 'Functions of Two Variables', topic: 'Multivariable', summary: 'Explore z = f(x, y) surfaces with contour lines, cross-sections and a tangent plane you can drag.' },
  { id: 'trig', subject: 'math', title: 'The Unit Circle & Waves', topic: 'Trigonometry', summary: 'Spin a point round the unit circle and watch sine and cosine unroll into waves in 3D.' },
  { id: 'revolution', subject: 'math', title: 'Solids of Revolution', topic: 'Calculus', summary: 'Spin a curve round an axis, slice it into discs, and watch the sum converge to the integral.' },
  { id: 'matrices', subject: 'math', title: 'Matrices as Transformations', topic: 'Linear Algebra', summary: 'Bend 3D space with a matrix: stretch, shear, rotate and reflect a grid, and see the determinant as a change in volume.' },
];

export const lessonById = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const subjectById = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
