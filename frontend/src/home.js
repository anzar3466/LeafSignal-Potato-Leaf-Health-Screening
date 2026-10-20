import React, { useEffect, useState } from "react";
import axios from "axios";
import { DropzoneArea } from "material-ui-dropzone";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import CloudUpload from "@material-ui/icons/CloudUpload";
import Eco from "@material-ui/icons/Eco";
import ErrorOutline from "@material-ui/icons/ErrorOutline";
import Replay from "@material-ui/icons/Replay";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/predict";

export const ImageUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) return undefined;

    let active = true;
    const formData = new FormData();
    formData.append("file", selectedFile);
    setIsLoading(true);
    setData(null);
    setError("");

    axios.post(API_URL, formData)
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((requestError) => {
        if (active) {
          const detail = requestError.response && requestError.response.data && requestError.response.data.detail;
          setError(typeof detail === "string" ? detail : "We couldn't reach the analysis service. Check that the API is running and try again.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [selectedFile]);

  const clearScan = () => {
    setSelectedFile(null);
    setPreview("");
    setData(null);
    setError("");
    setIsLoading(false);
  };

  const onSelectFile = (files) => {
    if (!files || files.length === 0) return;
    setSelectedFile(files[0]);
  };

  const score = data ? Number(data.confidence) : 0;
  const scorePercent = Number.isFinite(score) ? Math.max(0, Math.min(100, score * 100)) : 0;
  const isConfident = data && data.is_confident !== false;
  const isWrongImage = Boolean(data && data.wrong_image);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Leaf Signal home">
          <span className="brand-mark"><Eco /></span>
          <span className="brand-name">LEAF<span>/</span>SIGNAL</span>
        </a>
        <div className="system-status">LOCAL SCREENING <span className="status-divider">/</span> POTATO LEAF
        </div>
      </header>

      <main className="dashboard">
        <section className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> PLANT HEALTH SCAN <span className="eyebrow-index">FIELD TOOL&nbsp; 01</span></div>
          <Typography component="h1" className="headline">
            A closer look at<br /><span>your potato leaf.</span>
          </Typography>
          <p className="intro-copy">Add a leaf photo to screen for common potato diseases. Clear focus and even light help the model read the image.</p>
        </section>

        <section className="workspace" aria-label="Leaf analysis workspace">
          <div className="panel image-panel">
            <div className="panel-heading">
              <div className="panel-step">01 <span>/</span> IMAGE INPUT</div>
              <span className="panel-meta">JPG · PNG</span>
            </div>

            {preview ? (
              <div className="preview-frame">
                <img className="leaf-preview" src={preview} alt="Selected potato leaf" />
                <div className="preview-corner preview-corner-tl" />
                <div className="preview-corner preview-corner-tr" />
                <div className="preview-corner preview-corner-bl" />
                <div className="preview-corner preview-corner-br" />
                <div className="preview-label"><span className="status-dot" /> IMAGE LOADED</div>
              </div>
            ) : (
              <div className="dropzone-wrap">
                <DropzoneArea
                  acceptedFiles={["image/*"]}
                  filesLimit={1}
                  maxFileSize={12000000}
                  dropzoneText="Drop a leaf image here"
                  onChange={onSelectFile}
                  showAlerts={false}
                  showPreviewsInDropzone={false}
                />
                <div className="dropzone-guidance"><CloudUpload /><span>or click to browse your files</span></div>
              </div>
            )}

            <div className="input-hint">
              <span className="hint-icon"><span>i</span></span>
              <span>Frame one leaf, fill the view, avoid harsh shadows.</span>
            </div>
            {(data || error) && (
              <Button className="reset-button" onClick={clearScan} startIcon={<Replay />}>
                Scan another leaf
              </Button>
            )}
          </div>

          <div className={`panel analysis-panel ${data && (!isConfident || isWrongImage) ? "analysis-panel-uncertain" : ""}`}>
            <div className="panel-heading">
              <div className="panel-step">02 <span>/</span> ANALYSIS</div>
              <span className={`analysis-state ${isLoading ? "state-running" : data ? (isWrongImage ? "state-review" : isConfident ? "state-complete" : "state-review") : ""}`}>
                {isLoading ? "SCANNING" : data ? (isWrongImage ? "WRONG IMAGE" : isConfident ? "SCAN COMPLETE" : "REVIEW NEEDED") : "STANDING BY"}
              </span>
            </div>

            {isLoading ? (
              <div className="analysis-empty analysis-loading">
                <div className="loader-orbit"><CircularProgress size={54} thickness={2} /></div>
                <span className="empty-kicker">PROCESSING IMAGE</span>
                <p>Looking for visual patterns in the leaf.</p>
              </div>
            ) : error ? (
              <div className="analysis-empty error-state">
                <ErrorOutline />
                <span className="empty-kicker">CONNECTION INTERRUPTED</span>
                <p>{error}</p>
              </div>
            ) : data ? (
              isWrongImage ? (
                <div className="result-content wrong-image-result" role="alert">
                  <div className="result-overline">IMAGE OUT OF SCOPE</div>
                  <div className="result-title-row">
                    <Typography component="h2" className="result-title">Wrong image</Typography>
                    <span className="result-symbol symbol-review"><ErrorOutline /></span>
                  </div>
                  <div className="result-note result-note-warning">
                    <span className="note-indicator" />
                    <p>{data.message || "This is not potato leaf image, please upload potato leaf images only."}</p>
                  </div>
                </div>
              ) : <div className="result-content">
                <div className="result-overline">{isConfident ? "TOP MATCH" : "BEST MATCH · REVIEW NEEDED"}</div>
                <div className="result-title-row">
                  <Typography component="h2" className="result-title">{data.class}</Typography>
                  <span className={`result-symbol ${isConfident ? "symbol-ready" : "symbol-review"}`}>
                    {isConfident ? <Eco /> : <ErrorOutline />}
                  </span>
                </div>
                <div className="score-block">
                  <div className="score-label-row"><span>MODEL SCORE</span><strong>{scorePercent.toFixed(1)}<small>%</small></strong></div>
                  <div className="score-track" role="progressbar" aria-label="Model score" aria-valuenow={scorePercent} aria-valuemin={0} aria-valuemax={100}>
                    <span className="score-fill" style={{ width: `${scorePercent}%` }} />
                    <span className="score-threshold" title="90% display threshold" />
                  </div>
                  <div className="score-scale"><span>0</span><span>90% DISPLAY THRESHOLD</span><span>100</span></div>
                </div>
                <div className={`result-note ${!isConfident ? "result-note-warning" : ""}`}>
                  <span className="note-indicator" />
                  <p>{isConfident
                    ? "The score clears the display threshold. It is not a calibrated probability, and the model can still be wrong."
                    : "This is the model's best match, but its score is below the display threshold. Try a close, well-lit photo of one leaf, then compare with a local expert."}</p>
                </div>
              </div>
            ) : (
              <div className="analysis-empty">
                <div className="scan-graphic"><span className="scan-ring scan-ring-outer" /><span className="scan-ring scan-ring-inner" /><Eco /></div>
                <span className="empty-kicker">AWAITING LEAF IMAGE</span>
                <p>Your screening result will appear here.</p>
              </div>
            )}
          </div>
        </section>

        <section className="workflow" aria-label="Analysis steps">
          <div className="workflow-item"><span className="workflow-number">01</span><span>UPLOAD IMAGE</span></div>
          <span className="workflow-connector" />
          <div className="workflow-item"><span className="workflow-number">02</span><span>MODEL SCREEN</span></div>
          <span className="workflow-connector" />
          <div className="workflow-item"><span className="workflow-number">03</span><span>REVIEW RESULT</span></div>
          <div className="workflow-note">DECISION SUPPORT · NOT A FINAL DIAGNOSIS</div>
        </section>

        <footer className="page-footer">
          <span>LEAF/SIGNAL <span className="footer-separator">·</span> POTATO HEALTH SCREENING</span>
          <p className="page-disclaimer">Disclaimer: This tool provides an automated screening result, not a medical or agricultural diagnosis. Predictions can be incorrect; confirm suspected disease with a qualified agricultural expert.</p>
        </footer>
      </main>
    </div>
  );
};
