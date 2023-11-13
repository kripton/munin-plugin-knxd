const xml = require('sax-parser');
const fs = require('fs');
const process = require('process');
const child_process = require('child_process');
const knxDPT = require('knx-datapoints');

var level = 0;
var area = '';
var type = '';

var parser = new xml.SaxParser(function(cb) {
  cb.onEndDocument(function() {process.exit();});
  cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
		level++;
		if ((level == 2) && (elem == 'GroupRange'))  {
			area = attrs[0][1];
		} else if ((level == 3) && (elem == 'GroupRange'))  {
			type = attrs[0][1];
		} else if ((level == 4) && (elem == 'GroupAddress'))  {
			let attrObj = {};
			attrs.forEach((element) => {
				attrObj[element[0]] = element[1];
			});
			let desc = attrObj.Description || '';
			if (desc.startsWith(area)) {
				desc = desc.substring(area.length + 1);
			}
			
			let dptid = '';
			let dptValid = false;
			let dptSupported = false;
			if (attrObj.DPTs.startsWith('DPST-')) {
				let mt = parseInt(attrObj.DPTs.split('-')[1], 10);
				let st = parseInt(attrObj.DPTs.split('-')[2], 10);
				dptid = mt + '.' + ('' + st).padStart(3, '0');
				dptValid = knxDPT.isDptValid(dptid);
				dptSupported = knxDPT.isDptSupported(dptid);
			}

			//console.log('AREA: "' + area + '", TYPE: "' + type + '", Name: "' + attrObj.Name + '" ADDRESS: ' + attrObj.Address + ' DESC: "' + desc + '" DPT: ' + dptid + ' DPTVALID: ' + dptValid + ' DPTSUPPORTED: ' + dptSupported);

			if (!dptValid || !dptSupported) {
				return;
			}

			// Try getting the value
			let ret = '';
			let sender = '';
			let rawValueString = '';
			let decoded;
			try {
				ret = child_process.execSync('/home/kripton/git/knxd/src/tools/knxtool groupcacheread ip:10.5.147.3 ' + attrObj.Address, {stdio: ['ignore', 'pipe', 'ignore']});
				sender = ret.toString().split(':')[0].split(' ')[2];
				rawValueString = ret.toString().split(':')[1].trim();

				//console.log('SENDER: ' + sender + ' RAW VALUE: ' + rawValueString);

				// Decode the value:
				decoded = knxDPT.decode(dptid, Buffer.from(rawValueString.replaceAll(' ', ''), 'hex'));
				
				if (typeof(decoded) === 'object') {
					decoded = JSON.stringify(decoded);
				}

				console.log('AREA: "' + area + '", TYPE: "' + type + '", Name: "' + attrObj.Name + '" ADDRESS: ' + attrObj.Address + ' DESC: "' + desc + '" VALUE: "' + decoded + '"');
			} catch (e) {
				//console.log("NO VALUE!", e);
			}
			
		}
  });
  cb.onEndElementNS(function(elem, prefix, uri) {
		level--;
  });
});

const xmlFile = fs.readFileSync('group_addresses_export.xml', 'utf8');
parser.parseString(xmlFile);
