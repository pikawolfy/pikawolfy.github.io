let parsedLogs;

document.getElementById('upload').onchange = function (event) {
	let filename = this.value;
	filename = "logs/" + filename.substring(filename.lastIndexOf("\\") + 1);
	parseJSON = new Promise(function(resolve, reject) {
		d3.text(filename, json => {
			resolve(JSON.parse(json));
		});
	}).then(logs => {
		parsedLogs = logs;
		createGraph(logs);
	});
};

const elk = new ELK();

const graph = {
  id: "root",
  layoutOptions: { 'elk.algorithm': 'layered', 
  				   'elk.layered.feedbackEdges' : true},
  children: [],
  edges: []
}

const svgDiv = d3.select("#svgDiv");
let nodeW = 30;

nodeColors = ['#56a069', '#7498bc', '#e2c573']
nodeStrokeCols = ['#173d21', '#1b242d', '#262112']
libMap = new Map();

function createGraph(logs) {
	let libIndex = 1;
	const mapHeight = d3.scaleLinear().domain([0, 30]).range([20, 40])

	nodes = [];
	edges = new Map();
	Object.entries(logs.functions).forEach(([name, values]) => {
		nodes.push({'id':name, 'width':nodeW, 
					'height': values.calls ? mapHeight(values.calls.length) : 20, 
					'selfDefined' : values.selfDefined == 'true' ? true : false,
					'library' : values.selfDefined == 'true' ? 'NA' : values.library});

		if(values.selfDefined == 'true') {
			values.calls.forEach(call => {
				let key = name + '-' + call.fName;
				if (edges.has(key)) {
					edges.set(key, edges.get(key) + 1);
				}
				else {
					edges.set(key, 1);
				}
			});
		}
		else {
			if (!libMap.has(values.library)) {
				libMap.set(values.library, libIndex);
				libIndex ++;
			}
		}
	});

	graph.children = nodes;
	edges.forEach((val, key) => {
		graph.edges.push({'id': key, 'source': key.split('-')[0], 'target': key.split('-')[1], 'weight' : val})
	});

	elk.layout(graph)
   	.then(displayGraph);
}

function sidePanel() {
	let sidePanel = document.getElementById('sidePanel');
	let activeFiles = document.getElementById('files');
	let libraries = document.getElementById('libs');
	sidePanel.style.height = window.innerHeight - 65 + 'px';
	sidePanel.style.width = 220 + 'px';
	sidePanel.style.visibility = "visible";

	parsedLogs.files.forEach(filename => {
		let p = document.createElement('P');
		let t = document.createTextNode(filename);
		p.appendChild(t);
		activeFiles.appendChild(p);
	});

	Object.entries(parsedLogs.libraries).forEach(([tmp, lib]) => {
		console.log(lib);
		let d = document.createElement('div');
		let a = document.createElement('a');
		let t = document.createTextNode(lib.libName);
		a.appendChild(t);
		a.href = lib.url;
		a.target = 'blank';
		d.appendChild(a);
		libraries.appendChild(d);
	});
}

function displayGraph(elkGraph) {
	// console.log(elkGraph);

	sidePanel();

	const mapX = d3.scaleLinear().domain([0, elkGraph.width]).range([220, window.innerWidth])
	const mapY = d3.scaleLinear().domain([0, elkGraph.height]).range([20, window.innerHeight - 70])

	var dims = {
        width: window.innerWidth - 50,
        height: window.innerHeight - 70,
        svg_dx: 220,
        svg_dy: 0
    };

	function zoomed() {
      g.attr('transform', d3.event.transform);
      if(d3.event.transform.k > 1) {
      	document.getElementById('svgDiv').style.cursor = "move";
      }
      else {
      	document.getElementById('svgDiv').style.cursor = "default";
      }
    }

	const zoom = d3.zoom()
      .extent([[dims.svg_dx, dims.svg_dy], [dims.width-(dims.svg_dx*2), dims.height-dims.svg_dy]])
        .scaleExtent([1, 10])
        .translateExtent([[dims.svg_dx, dims.svg_dy], [dims.width-(dims.svg_dx*2), dims.height-dims.svg_dy]])
        .on('zoom', zoomed);

	svgDiv.append('svg').attr('width', window.innerWidth - 50)
						.attr('height', window.innerHeight - 70)
						.attr('id', 'svg');

	let svg = d3.select('#svg');
	svg.call(zoom)

	let g = svg.append('g');

	let nodes = g.append('g').attr('id', 'nodes');
	let nodeLabels = nodes.append('g').attr('id', 'nodeLabels');
	let edges = g.append('g').attr('id', 'edges');

	nodes.selectAll('rect')
		 .data(elkGraph.children, n => n)
		 .enter()
		 .append('rect')
		 .attr('x', n => mapX(n.x))
		 .attr('y', n => mapY(n.y))
		 .attr('rx', 8)
		 .attr('ry', 8)
		 .attr('width', n => n.width * 3)
		 .attr('height', n => n.height * 3)
		 .attr('fill', n => n.selfDefined ? nodeColors[0] : nodeColors[libMap.get(n.library)])
		 .attr('stroke', n => n.selfDefined ? nodeStrokeCols[0] : nodeStrokeCols[libMap.get(n.library)]);

	nodeLabels.selectAll('text')
		 .data(elkGraph.children, n => n)
		 .enter()
		 .append('text')
		 .attr('x', n => mapX(n.x))
		 .attr('y', n => mapY(n.y) - 10)
		 .attr('font-size', '14px')
		 .attr('font-family', 'Quicksand')
		 .attr('fill', '#222222')
		 .text(n => n.id);

	 var lineFunction = d3.line()
	 					.x(function(d) { return d.x; })
	 					.y(function(d) { return d.y; });

	function getNode(name) {
		for(let i = 0; i < elkGraph.children.length; i++) {
			let node = elkGraph.children[i];
			if (node.id == name) {
				return node;
			}
		}
	}

	const mapEdgeWidth = d3.scaleLinear().domain([0, 50]).range([2, 7]);

	elkGraph.edges.forEach(edge => {
		let path = [];
		let src = getNode(edge.source);
		// console.log(src.x)
		// console.log(edge.sections[0].startPoint.x)
		path.push({'x': mapX(src.x) + nodeW * 3, 'y': mapY(edge.sections[0].startPoint.y) - 5});
		if (edge.sections[0].bendPoints) {
			edge.sections[0].bendPoints.forEach(pt => {
				path.push({'x': mapX(pt.x), 'y': mapY(pt.y) - 5});
			});
		}
		path.push({'x': mapX(edge.sections[0].endPoint.x), 'y': mapY(edge.sections[0].endPoint.y) - 5});

		edges.append('path').data([path])
							.attr('d', lineFunction)
							.attr('stroke', '#666666')
							.attr('fill', 'none')
							.attr('stroke-width', mapEdgeWidth(edge.weight))
							.attr('stroke-linejoin', 'round');

		edges.append('circle')
			 .attr('cx', mapX(edge.sections[0].endPoint.x))
			 .attr('cy', mapY(edge.sections[0].endPoint.y) - 5)
			 .attr('r', 3)
			 .attr('fill', '#666666');
	});

}
