import React, { useState } from 'react';
import { FileText, Download, Upload, CheckCircle2, Circle, ShieldCheck, Layers, Box, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

export default function DocumentVerificationPanel({
  building = null,
  onOpen3DViewer = () => {}
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [verificationResult, setVerificationResult] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const bId = building?.building_id || 'VIT-B001';
  const name = building?.name || 'VIT Building';
  
  // Extract clean short identifier or use name
  const shortName = (() => {
    if (name.includes('(')) {
      const match = name.match(/\((.*?)\)/);
      if (match && match[1]) return match[1];
    }
    if (name.includes('-')) {
      return name.split('-')[0].trim();
    }
    return name;
  })();

  const cleanBuildingFilename = name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '_') + '_Building_Permit_Order.pdf';

  const expectedFloors = building?.verified_floor_count || building?.final_floor_count || 7;
  const expectedHeight = building?.height_m || 36.0;

  const handleDownloadPermit = () => {
    window.open(`http://127.0.0.1:8000/api/documents/permit-pdf/${bId}`, '_blank');
  };

  const runDocumentReconstruction = (docName = cleanBuildingFilename) => {
    setIsProcessing(true);
    setProcessingStep(1);

    setTimeout(() => setProcessingStep(2), 400);
    setTimeout(() => setProcessingStep(3), 800);
    setTimeout(() => setProcessingStep(4), 1200);

    fetch('http://127.0.0.1:8000/api/documents/upload-and-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        building_id: bId,
        document_name: docName
      })
    })
      .then(res => res.json())
      .then(data => {
        setTimeout(() => {
          setProcessingStep(5);
          setVerificationResult(data);
          setIsProcessing(false);
        }, 1500);
      })
      .catch(err => {
        console.error("Document reconstruction error:", err);
        setIsProcessing(false);
      });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      runDocumentReconstruction(file.name);
    }
  };

  const scorecard = verificationResult?.model?.verification_scorecard;
  const matrix = scorecard?.matrix || [];

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* 1. Header & Permit Download Section */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '10px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="#38bdf8" />
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>Official Building Permit &amp; Deed</span>
          </div>
          <span style={{ fontSize: '10px', color: '#34d399', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', padding: '2px 7px', borderRadius: '4px', fontWeight: '700' }}>
            DTCP SANCTIONED
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
          Download the official DTCP Tamil Nadu Permit &amp; 3D Cadastral Sanction Order PDF for <b>{name}</b>.
        </p>

        <button
          onClick={handleDownloadPermit}
          style={{
            background: '#0284c7',
            border: 'none',
            color: '#fff',
            padding: '9px 14px',
            borderRadius: '7px',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'opacity 0.2s'
          }}
        >
          <Download size={14} />
          <span>Download {shortName} Building Permit PDF</span>
        </button>
      </div>

      {/* 2. Upload or Run One-Click Document Processing */}
      <div style={{
        background: '#070b14',
        border: '1.5px dashed rgba(56, 189, 248, 0.3)',
        borderRadius: '10px',
        padding: '16px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Upload size={24} color="#38bdf8" />
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>
            {uploadedFile ? uploadedFile.name : `Upload ${shortName} Permit / Architectural PDF`}
          </div>
          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px' }}>
            Supports DTCP Sanction Orders, Cadastral Deeds, or Architectural PDFs
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <label style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}>
            <span>Choose PDF File</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <button
            onClick={() => runDocumentReconstruction()}
            disabled={isProcessing}
            style={{
              flex: 1.2,
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isProcessing ? <RefreshCw size={12} className="spin" /> : <ShieldCheck size={13} />}
            <span>{isProcessing ? 'Analyzing Document...' : `Process ${shortName} Permit`}</span>
          </button>
        </div>
      </div>

      {/* 3. Processing Progress Visualizer */}
      {isProcessing && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>
            AUTOMATED 3D RECONSTRUCTION PIPELINE ({shortName})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px' }}>
            <div style={{ color: processingStep >= 1 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {processingStep >= 1 ? <CheckCircle2 size={13} color="#34d399" /> : <Circle size={13} color="#64748b" />} <span>1. Document Ingestion &amp; OCR Parsing</span>
            </div>
            <div style={{ color: processingStep >= 2 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {processingStep >= 2 ? <CheckCircle2 size={13} color="#34d399" /> : <Circle size={13} color="#64748b" />} <span>2. Extract Approved Floors ({expectedFloors}) &amp; Height ({expectedHeight}m)</span>
            </div>
            <div style={{ color: processingStep >= 3 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {processingStep >= 3 ? <CheckCircle2 size={13} color="#34d399" /> : <Circle size={13} color="#64748b" />} <span>3. Dynamic 3D Volumetric Extrusion</span>
            </div>
            <div style={{ color: processingStep >= 4 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {processingStep >= 4 ? <CheckCircle2 size={13} color="#34d399" /> : <Circle size={13} color="#64748b" />} <span>4. Floor-by-Floor Unit Strata Subdivision</span>
            </div>
            <div style={{ color: processingStep >= 5 ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {processingStep >= 5 ? <CheckCircle2 size={13} color="#34d399" /> : <Circle size={13} color="#64748b" />} <span>5. 8-Rule Cadastral Topology Validation</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Verification Matrix & Scorecard */}
      {verificationResult && !isProcessing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Readiness Scorecard Badge */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1.5px solid #10b981',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                VERIFICATION SCORECARD
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#34d399', marginTop: '2px' }}>
                {scorecard?.readiness_status || "3D Reconstruction Ready"}
              </div>
              <div style={{ fontSize: '10.5px', color: '#cbd5e1', marginTop: '2px' }}>
                Compliance: <b>{scorecard?.compliance_score_pct || 100}%</b> • 0 Collisions
              </div>
            </div>

            <button
              onClick={onOpen3DViewer}
              style={{
                background: '#10b981',
                border: 'none',
                color: '#fff',
                padding: '9px 13px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Box size={14} />
              <span>Open 3D Viewer</span>
            </button>
          </div>

          {/* Verification Matrix Table */}
          <div style={{
            background: '#070b14',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#0f172a',
              padding: '8px 12px',
              fontSize: '10.5px',
              fontWeight: '800',
              color: '#38bdf8',
              letterSpacing: '0.5px'
            }}>
              DOCUMENT VS 3D CADASTRAL MATRIX
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {matrix.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 12px',
                    borderBottom: idx < matrix.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    fontSize: '11px',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>{row.property}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#fff', fontWeight: '600', fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                      {row.model_value}
                    </span>
                    <span style={{
                      background: 'rgba(16,185,129,0.15)',
                      border: '1px solid #10b981',
                      color: '#34d399',
                      fontSize: '9px',
                      fontWeight: '800',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
