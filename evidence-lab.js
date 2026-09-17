(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  let currentReport = null;
  const fields = ['sender','recipient','nonce','value_wei','calldata','calldata_sha256','execution_status','gas_limit','gas_price_wei','max_fee_per_gas_wei','max_priority_fee_per_gas_wei','timing_evidence'];
  const example = {
    transaction_hash: '0x2780f91022d1364efc63b94161ad0bc80b93e315414be33f58054de3632903ab',
    sender: '0x31d43856566fc3bc465f67e7e1e48cbda40d6e68', recipient: '0x07ea2ff889e6228cded329a09f66e370f12c705e',
    nonce: '107', value_wei: '0', execution_status: 'SUCCESS', gas_limit: '134461',
    max_fee_per_gas_wei: '50000000000', max_priority_fee_per_gas_wei: '10000000000'
  };

  function text(value) { return value == null ? 'Unavailable' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
  function escape(value) { const node = document.createElement('span'); node.textContent = text(value); return node.innerHTML; }
  function state(message, error = false) { byId('labState').textContent = message; byId('labState').className = `lab-state${error ? ' error' : ''}`; }
  function declaration(form) {
    const data = new FormData(form); const expectations = {};
    fields.forEach(field => { const value = String(data.get(field) || '').trim(); if (value) expectations[field] = value; });
    return { transaction_hash: String(data.get('transaction_hash') || '').trim(), expectations };
  }
  function render(report) {
    currentReport = report;
    const counts = { MATCH:0, MISMATCH:0, UNKNOWN:0, UNSUPPORTED:0 };
    report.checks.forEach(item => { counts[item.result] = (counts[item.result] || 0) + 1; });
    byId('summary').innerHTML = Object.entries(counts).map(([name,count]) => `<span class="result-${name.toLowerCase()}">${name} · ${count}</span>`).join('');
    byId('mandatoryNotice').textContent = report.notice;
    byId('checkRows').innerHTML = report.checks.map(item => `<tr><td data-label="Check"><span class="check-value">${escape(item.field)}<small>${escape(item.reason)}</small></span></td><td data-label="Result" class="result-${item.result.toLowerCase()}"><span class="result-value">${escape(item.result)}</span></td><td data-label="Expected"><span class="cell-value">${escape(item.expected)}</span></td><td data-label="Observed"><span class="cell-value">${escape(item.observed)}</span></td></tr>`).join('');
    const fee = report.fee_evidence || {};
    byId('evidenceDetails').innerHTML = `<article><h3>Block / finality</h3><p>${escape(report.finality.status)}</p><p>${escape(report.finality.basis)}</p><p>Block: ${escape(report.block_reference)}</p></article><article><h3>Fees</h3><p>Maximum settings: ${escape(fee.maximum_settings)}</p><p>Actual execution: ${escape(fee.actual_execution)}</p><p>${escape(fee.distinction)}</p></article><article><h3>Source</h3><p>${escape(report.observation.source)}</p><p>${escape(report.observation.observed_at_utc)}</p><p>${escape(report.observation.trust_assumption)}</p></article><article><h3>Declaration seal</h3><p>${escape(report.declaration_digest.value)}</p><p>Tool ${escape(report.tool.version)} · schema ${escape(report.schema_version)}</p></article>`;
    byId('limitations').innerHTML = report.limitations.map(item => `<li>${escape(item)}</li>`).join('');
    byId('reportDigest').textContent = `Report SHA-256 · ${report.digest.value}`;
    byId('results').hidden = false;
    byId('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  byId('loadExample').addEventListener('click', () => { Object.entries(example).forEach(([name,value]) => { const input = document.querySelector(`[name="${name}"]`); if (input) input.value = value; }); state('Public Sepolia example loaded. Review the values, then verify.'); });
  byId('evidenceForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = byId('verifyButton'); button.disabled = true; button.textContent = 'OBSERVING…'; state('Reading bounded evidence from the configured Sepolia RPC. Nothing is sent to the chain.');
    try {
      const response = await fetch('/api/evidence-lab', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(declaration(event.currentTarget)) });
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Evidence request failed.');
      render(payload); state('Evidence report created. Review each check; no broad PASS is inferred.');
    } catch (error) { currentReport = null; byId('results').hidden = true; state(error.message, true); }
    finally { button.disabled = false; button.textContent = 'VERIFY EXISTING TRANSACTION'; }
  });
  byId('downloadReport').addEventListener('click', () => { if (currentReport) window.PortalEvidenceExport.downloadJson(currentReport, `portal-sepolia-evidence-${currentReport.transaction_identity.hash}.json`); });
  byId('exportFile').addEventListener('change', async event => {
    const output = byId('exportVerification'); output.className = 'lab-state';
    try { const file = event.target.files[0]; if (!file) return; const document = JSON.parse(await file.text()); const result = await window.PortalEvidenceExport.verifyDocumentDigest(document); output.textContent = result.valid ? `MATCH · locally calculated SHA-256 ${result.calculated}` : `MISMATCH · expected ${result.expected || 'missing'}, calculated ${result.calculated || 'unavailable'}`; output.className = `lab-state${result.valid ? '' : ' error'}`; }
    catch (error) { output.textContent = `INVALID · ${error.message}`; output.className = 'lab-state error'; }
  });
}());
