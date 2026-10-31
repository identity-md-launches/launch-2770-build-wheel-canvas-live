import { useEffect, useMemo, useState } from "react";
import { useConnection, useDisconnect } from "wagmi";
import { Artwork } from "./components/Artwork";
import { Hamster, Icon } from "./components/Icon";
import { Modal } from "./components/Modal";
import { WalletSheet } from "./components/WalletSheet";
import { addressHue, ART_VERSION, downloadCard } from "./lib/art";
import {
  buildNights,
  dayKey,
  formatDate,
  formatMinted,
  formatNumber,
  shortAddress,
  emptyNight,
} from "./lib/data";
import type { Night } from "./lib/data";
import { useWheelData } from "./lib/use-data";
import { useSigners } from "./lib/signers";
import { useSign } from "./lib/use-sign";
import { CHAIN_ID, TOKEN } from "./lib/chain";

function readHash() {
  const match = location.hash.match(/^#night\/(\d{4}-\d{2}-\d{2})$/);
  if (!match || !Number.isFinite(Date.parse(`${match[1]}T00:00:00Z`)))
    return undefined;
  return dayKey(Date.parse(`${match[1]}T00:00:00Z`)) === match[1]
    ? match[1]
    : undefined;
}
function ShareControls({ night, address }: { night: Night; address?: string }) {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const signed =
    address &&
    night.signers?.some((s) => s.toLowerCase() === address.toLowerCase());
  const url = new URL(location.href);
  url.hash = `night/${night.date}`;
  const shareText = `${signed ? "I signed" : "Meet"} the ${formatDate(night.date)} Wheel Canvas, built on Squeekchain. Painted by Squeektoshi, Squeekchain’s hamster. ${formatNumber(night.work)} work units, ${formatNumber(night.blocks)} blocks. One little wheel, a community of colors. #Squeekchain`;
  const download = async () => {
    setDownloading(true);
    setMessage("");
    try {
      await downloadCard(night, address);
      setMessage("PNG ready. Check your downloads.");
    } catch {
      setMessage(
        "Could not create the PNG. Try again in a browser with canvas support.",
      );
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="share-controls">
      <div className="button-row">
        <button
          className="button secondary"
          onClick={() => void download()}
          disabled={downloading || night.source === "unavailable"}
        >
          <Icon name="download" size={18} />
          {downloading ? "Creating PNG…" : "Download PNG"}
        </button>
        {night.source === "unavailable" ? (
          <button className="button quiet" disabled>
            <Icon name="x" size={17} />
            Share on X<Icon name="external" size={14} />
          </button>
        ) : (
          <a
            className="button quiet"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url.href)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="x" size={17} />
            Share on X<Icon name="external" size={14} />
          </a>
        )}
      </div>
      <div className="share-feedback" role="status">
        {message}
      </div>
    </div>
  );
}
function SignerList({
  signers,
  small = false,
}: {
  signers: string[] | null;
  small?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (signers === null)
    return (
      <p className="muted signer-empty">Reading signatures from Sepolia…</p>
    );
  if (!signers.length)
    return (
      <p className="muted signer-empty">
        A quiet canvas, waiting for its first signature.
      </p>
    );
  const visible = expanded ? signers : signers.slice(0, small ? 3 : 8);
  return (
    <>
      <ul className="signer-list">
        {visible.map((address) => (
          <li key={address}>
            <span
              className="signer-swatch"
              style={{ backgroundColor: `hsl(${addressHue(address)},75%,70%)` }}
            />
            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Signer ${address}`}
            >
              {shortAddress(address)}
              <Icon name="external" size={12} />
            </a>
          </li>
        ))}
      </ul>
      {signers.length > visible.length && (
        <button className="text-button" onClick={() => setExpanded(true)}>
          Show all {signers.length} signers
          <Icon name="arrow" size={14} />
        </button>
      )}
    </>
  );
}
function NightViewer({
  night,
  address,
  onClose,
  previous,
  next,
  onNavigate,
  signerError,
  onRetry,
}: {
  night: Night;
  address?: string;
  onClose: () => void;
  previous?: string;
  next?: string;
  onNavigate: (date: string) => void;
  signerError: boolean;
  onRetry: () => void;
}) {
  const saveData = () => {
    const blob = new Blob(
      [JSON.stringify({ version: ART_VERSION, night }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `wheel-canvas-${night.date}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Modal wide title={formatDate(night.date, true)} onClose={onClose}>
      <div className="viewer-art">
        <Artwork night={night} />
        {night.source === "unavailable" && (
          <div className="canvas-message">
            Waiting for data. Past nights appear after their settlement bucket closes.
          </div>
        )}
      </div>
      <div className="viewer-toolbar">
        <p className="pixel">
          {night.source === "unavailable"
            ? "Waiting for data"
            : `${formatNumber(night.work)} work · ${formatNumber(night.blocks)} blocks`}{" "}
          · {night.signers === null ? "Checking" : night.signers.length} signers
        </p>
        <ShareControls night={night} address={address} />
      </div>
      <details className="night-details">
        <summary>Signatures &amp; artwork data</summary>
        <SignerList signers={night.signers} />
        {signerError && (
          <p className="muted">
            Sepolia reads are unavailable.{" "}
            <button className="text-button" onClick={onRetry}>
              Retry signatures
            </button>
          </p>
        )}
        <p className="muted">
          {night.source === "unavailable"
            ? "Waiting for a completed settlement snapshot. Past nights appear after their bucket closes. Signatures use the labeled UTC date."
            : night.source === "daily"
              ? "The API’s archived settlement buckets span noon to noon UTC. The date labels the start of that interval. Signatures are from midnight to midnight UTC on the labeled date."
              : "Settlement work and signatures are grouped by UTC date. Tonight’s artwork continues to evolve."}
        </p>
        <p className="data-interval">
          Settlement interval:{" "}
          {night.intervalStart
            .replace("T", " ")
            .replace(".000Z", " UTC")
            .replace("Z", " UTC")}{" "}
          to{" "}
          {night.intervalEnd
            .replace("T", " ")
            .replace(".000Z", " UTC")
            .replace("Z", " UTC")}
        </p>
        <button className="text-button" onClick={saveData}>
          <Icon name="download" size={16} />
          Save artwork data
        </button>
      </details>
      <div className="viewer-navigation">
        <button
          className="button quiet"
          disabled={!previous}
          onClick={() => previous && onNavigate(previous)}
        >
          ← Earlier night
        </button>
        <span className="muted pixel">All dates UTC</span>
        <button
          className="button quiet"
          disabled={!next}
          onClick={() => next && onNavigate(next)}
        >
          Later night →
        </button>
      </div>
    </Modal>
  );
}
export default function App() {
  const data = useWheelData();
  const [selected, setSelected] = useState<string | undefined>(readHash);
  const signers = useSigners(data.today, selected);
  const [walletOpen, setWalletOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [allNights, setAllNights] = useState(false);
  const { address, isConnected, chainId } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const signature = useSign(signers.retry);
  useEffect(() => {
    const handler = () => setSelected(readHash());
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  const nights = useMemo(
    () =>
      buildNights(data.today, data.hourly.data, data.history.data).map(
        (night) => {
          const verified = signers.days[night.date]?.addresses;
          const confirmed =
            signature.confirmed?.date === night.date
              ? signature.confirmed.address
              : undefined;
          return {
            ...night,
            signers:
              verified || confirmed
                ? [
                    ...new Set([
                      ...(verified ?? []),
                      ...(confirmed ? [confirmed] : []),
                    ]),
                  ].sort((a, b) =>
                    a.toLowerCase().localeCompare(b.toLowerCase()),
                  )
                : null,
          };
        },
      ),
    [
      data.today,
      data.hourly.data,
      data.history.data,
      signers.days,
      signature.confirmed,
    ],
  );
  const tonight = nights[0],
    gallery = nights.slice(1);
  const selectedNight = selected
    ? (nights.find((n) => n.date === selected) ?? {
        ...emptyNight(selected),
        signers: signers.days[selected]?.addresses ?? null,
      })
    : undefined;
  const status = data.status.data;
  const statusStale =
    !!status &&
    (data.status.error ||
      status.freshness !== "online" ||
      Date.now() - Date.parse(status.observedAt) > 120_000);
  const live =
    status &&
    !statusStale &&
    dayKey(Date.parse(status.observedAt)) === data.today
      ? status
      : undefined;
  const hasErrors =
    data.status.error ||
    data.hourly.error ||
    data.history.error ||
    data.economy.error;
  const signed =
    !!address &&
    !!tonight.signers?.some((s) => s.toLowerCase() === address.toLowerCase());
  const navigate = (date: string) => {
    location.hash = `night/${date}`;
    setSelected(date);
  };
  const closeNight = () => {
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#gallery`,
    );
    setSelected(undefined);
  };
  const mainAction = () => {
    if (!isConnected) setWalletOpen(true);
    else void signature.sign();
  };
  const signLabel = signature.busy
    ? {
        switching: "Switching to Sepolia…",
        wallet: "Confirm in your wallet…",
        pending: "Waiting for confirmation…",
      }[signature.phase as "switching" | "wallet" | "pending"]
    : signed
      ? "You signed tonight’s canvas"
      : isConnected && chainId !== CHAIN_ID
        ? "Switch to Sepolia"
        : "Sign tonight’s canvas";
  return (
    <>
      <a className="skip-link" href="#live">
        Skip to canvas
      </a>
      <header className="site-header">
        <a href="#live" className="brand" aria-label="Wheel Canvas home">
          <Hamster />
          <span>
            Wheel Canvas<span className="brand-by">built on Squeekchain</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#live" className="active">
            Live canvas
          </a>
          <a href="#gallery">Gallery</a>
          <a href="#about">How it works</a>
        </nav>
        <div className="header-wallet">
          {isConnected && address ? (
            <>
              <button
                className="button quiet wallet-button"
                title={address}
                aria-label={`Disconnect wallet ${shortAddress(address)}`}
                onClick={() => disconnect()}
              >
                <span className="connection-dot" />
                {shortAddress(address)}
                <span className="disconnect-label"> · Disconnect</span>
              </button>
              {chainId !== CHAIN_ID && (
                <button
                  className="text-button network-switch"
                  onClick={() => void signature.changeChain()}
                >
                  Switch to Sepolia
                </button>
              )}
            </>
          ) : (
            <button
              className="button secondary wallet-button"
              onClick={() => setWalletOpen(true)}
            >
              <Icon name="wallet" size={17} />
              <span>
                Connect<span className="desktop-word"> wallet</span>
              </span>
            </button>
          )}
        </div>
      </header>
      <main>
        <section
          id="live"
          className="live-section page-width"
          aria-labelledby="live-heading"
        >
          <div className="intro">
            <div>
              <h1 id="live-heading">
                A little wheel. <span>Endless art.</span>
              </h1>
              <p>
                A living canvas painted by a hamster. A little color from you.
              </p>
            </div>
            <div className="tonight-date">
              <span className="live-label">
                <span
                  className={`status-dot ${live?.state === "SPINNING" ? "spinning" : ""}`}
                />
                {data.loading && !status
                  ? "Connecting"
                  : statusStale
                    ? "Last known state"
                    : live?.state === "SPINNING"
                      ? "Painting live"
                      : live?.state === "IDLE"
                        ? "The wheel is resting"
                        : "Waiting for wheel data"}
              </span>
              <time dateTime={data.today} className="pixel">
                {formatDate(data.today, true)} · UTC
              </time>
            </div>
          </div>
          <div className="canvas-frame">
            <div className="canvas-topline">
              <span className="pixel">Tonight’s canvas</span>
              <span className="canvas-version pixel">
                Squeektoshi × community
              </span>
              <div className="canvas-tools">
                <button
                  className="icon-button"
                  aria-label={
                    paused
                      ? "Resume canvas animation"
                      : "Pause canvas animation"
                  }
                  aria-pressed={paused}
                  onClick={() => setPaused((p) => !p)}
                >
                  <Icon name={paused ? "play" : "pause"} size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Open tonight’s canvas full size"
                  onClick={() => navigate(data.today)}
                >
                  <Icon name="expand" size={18} />
                </button>
              </div>
            </div>
            <div className="canvas-body">
              <div className="live-art">
                <Artwork night={tonight} live={live} paused={paused} />
                <div className="art-caption">
                  <span className="tiny-cross" aria-hidden="true">
                    +
                  </span>
                  <span>
                    {tonight.source === "unavailable"
                      ? data.loading
                        ? "Waiting for the first brushstroke…"
                        : "Waiting for settlement data"
                      : `${formatNumber(tonight.work)} work units, made into light.`}
                  </span>
                </div>
                <div className="art-orbit-label pixel" aria-hidden="true">
                  {live?.state === "IDLE"
                    ? "Rest is part of the art."
                    : "Every revolution leaves a trace."}
                </div>
              </div>
              <aside className="sign-panel" aria-labelledby="sign-heading">
                <div className="sign-intro">
                  <span className="pen-mark">
                    <Icon name="pen" size={26} />
                  </span>
                  <h2 id="sign-heading">Leave your mark.</h2>
                  <p>
                    One signature. One stroke.
                    <br />
                    Your color, part of tonight.
                  </p>
                </div>
                <button
                  className="button primary sign-button"
                  onClick={mainAction}
                  disabled={signature.busy || signed}
                >
                  <Icon name={signed ? "check" : "pen"} size={18} />
                  {signLabel}
                  {!signed && !signature.busy && (
                    <Icon name="arrow" size={18} />
                  )}
                </button>
                <p className="sign-safety">
                  Sepolia testnet · No real funds
                  <br />
                  Only a zero-value approval to yourself.
                </p>
                <div className="signature-feedback" role="status">
                  {signature.phase === "confirmed" && signature.confirmed
                    ? `Your stroke is on the ${formatDate(signature.confirmed.date)} canvas.`
                    : signature.error}
                  {signature.hash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${signature.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View transaction
                      <Icon name="external" size={12} />
                    </a>
                  )}
                  {signature.phase === "error" && signature.hash && (
                    <button
                      className="text-button"
                      onClick={() => void signature.check()}
                    >
                      Check confirmation again
                    </button>
                  )}
                </div>
                <div className="signers-heading">
                  <span className="pixel">Signers tonight</span>
                  <span className="signer-count">
                    {tonight.signers === null ? "…" : tonight.signers.length}
                  </span>
                </div>
                <SignerList signers={tonight.signers} small />
                {signers.error && (
                  <div className="signer-error">
                    <p>
                      Sepolia reads are unavailable.{" "}
                      {tonight.signers !== null
                        ? "Showing last verified signatures."
                        : "Signatures are not yet verified."}
                    </p>
                    <button className="text-button" onClick={signers.retry}>
                      Retry signatures
                      <Icon name="refresh" size={14} />
                    </button>
                  </div>
                )}
              </aside>
            </div>
            <dl className="live-stats">
              <div>
                <dt>Wheel status</dt>
                <dd className="wheel-state">
                  <Hamster size={24} sleeping={status?.state !== "SPINNING"} />
                  {status
                    ? status.state === "SPINNING"
                      ? "Spinning"
                      : "Resting"
                    : "Connecting"}
                  {statusStale && <span className="stale-tag">stale</span>}
                </dd>
              </div>
              <div>
                <dt>Wheel speed</dt>
                <dd>
                  {status ? status.speed.toFixed(3) : "…"}
                  <span className="unit">m/s</span>
                  <span className="rpm-value">
                    {status ? formatNumber(status.rpm, 1) : "…"} rpm
                  </span>
                </dd>
              </div>
              <div>
                <dt>Squeek block</dt>
                <dd>{status ? `#${formatNumber(status.height)}` : "…"}</dd>
              </div>
              <div className="progress-stat">
                <dt>
                  Block progress
                  <span>
                    {status ? `${(status.progress * 100).toFixed(1)}%` : "…"}
                  </span>
                </dt>
                <dd>
                  <progress
                    value={status?.progress ?? 0}
                    max="1"
                    aria-label="Current Squeek block progress"
                  />
                  <span className="progress-note">
                    A bright ring for every block.
                  </span>
                </dd>
              </div>
              <div>
                <dt>
                  SQK minted<span>{data.economy.error ? " · stale" : ""}</span>
                </dt>
                <dd>
                  {data.economy.data
                    ? formatMinted(data.economy.data.minted)
                    : "…"}
                  <span className="unit">SQK</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="below-canvas">
            <div className="data-status">
              <span
                className={`status-dot ${!hasErrors && !data.loading ? "connected" : ""}`}
              />
              <span>
                {hasErrors
                  ? status || data.hourly.data
                    ? "Connection interrupted. Keeping the last good data."
                    : "Data is unavailable. Reconnecting every 15 seconds."
                  : data.loading
                    ? "Connecting to Squeekchain…"
                    : "Live data · refreshes every 15 seconds"}
              </span>
              {hasErrors && (
                <button className="text-button" onClick={data.retry}>
                  Retry
                </button>
              )}
            </div>
            <ShareControls night={tonight} address={address} />
          </div>
        </section>
        <section
          id="gallery"
          className="gallery-section page-width"
          aria-labelledby="gallery-heading"
        >
          <div className="section-heading">
            <div>
              <h2 id="gallery-heading">No two nights alike.</h2>
              <p>Thirty nights of small steps and shared signatures.</p>
            </div>
            <span className="pixel muted">The nightly gallery</span>
          </div>
          <div className="gallery-grid">
            {gallery.slice(0, allNights ? 30 : 6).map((night) => (
              <article className="night-card" key={night.date}>
                <button
                  className="night-open"
                  onClick={() => navigate(night.date)}
                  aria-label={`Open canvas for ${formatDate(night.date, true)}`}
                >
                  <div className="night-thumbnail">
                    <Artwork night={night} thumbnail />
                    <span className="night-hover">
                      <Icon name="expand" size={20} />
                      <span>Explore canvas</span>
                    </span>
                    {night.source === "unavailable" && (
                      <span className="thumbnail-unavailable">
                        Waiting for data
                      </span>
                    )}
                  </div>
                  <div className="night-card-heading">
                    <h3>
                      <time dateTime={night.date}>
                        {formatDate(night.date, true)}
                      </time>
                    </h3>
                    <Icon name="arrow" size={18} />
                  </div>
                  <div className="night-card-data">
                    <span>
                      {night.source === "unavailable"
                        ? "Waiting for data"
                        : `${formatNumber(night.work)} work · ${formatNumber(night.blocks)} blocks`}
                    </span>
                    <span>
                      {night.signers === null
                        ? "Reading signers…"
                        : `${night.signers.length} signers`}
                    </span>
                  </div>
                </button>
              </article>
            ))}
          </div>
          <div className="gallery-bottom">
            <div>
              {signers.archiveError && (
                <p className="muted">
                  Historical signature reads are unavailable.{" "}
                  <button className="text-button" onClick={signers.retry}>
                    Retry signatures
                  </button>
                </p>
              )}
              <p className="muted">
                Archived work uses the API’s completed noon-to-noon UTC buckets.
                Signatures use the labeled UTC date.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setAllNights((v) => !v)}
            >
              {allNights ? "Show recent nights" : "Explore all 30 nights"}
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </section>
        <section
          id="about"
          className="about-section page-width"
          aria-labelledby="about-heading"
        >
          <div className="section-heading">
            <div>
              <h2 id="about-heading">A hamster. A wheel. All of us.</h2>
              <p>Real movement becomes a shared work of art.</p>
            </div>
            <a
              className="button secondary"
              href="https://sepolia.squeekchain.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="play" size={16} />
              Watch on Squeekchain
              <Icon name="external" size={14} />
            </a>
          </div>
          <div className="how-grid">
            <div>
              <span className="how-icon">
                <Icon name="wheel" size={26} />
              </span>
              <h3>The wheel paints.</h3>
              <p>
                Squeektoshi’s speed shapes each stroke. Work traces a spiral.
                Every completed Squeek block adds a golden ring. When the wheel
                rests, the colors settle.
              </p>
            </div>
            <div>
              <span className="how-icon">
                <Icon name="pen" size={26} />
              </span>
              <h3>You add a little color.</h3>
              <p>
                Sign once a night with a Sepolia wallet. Your address gives your
                stroke its own hue, recorded publicly on the SQK token. Repeat
                signatures add no extra strokes.
              </p>
            </div>
            <div>
              <span className="how-icon">
                <Icon name="download" size={26} />
              </span>
              <h3>The night is yours to keep.</h3>
              <p>
                Download a PNG, share your canvas, or save its data. The same
                date, work, block heights and signers always recreate the same
                artwork.
              </p>
            </div>
          </div>
          <details className="signing-details">
            <summary>What exactly am I signing?</summary>
            <div>
              <p>
                Wheel Canvas sends one transaction on Sepolia (chain ID
                11155111): <code>approve(your address, 0)</code> on the SQK
                token. It grants no spending allowance and transfers no tokens
                or ETH. You pay only Sepolia testnet gas. This app never
                requests a payment, token purchase, message signature, or any
                other approval.
              </p>
              <p>
                Token:{" "}
                <a
                  className="contract-address"
                  href={`https://sepolia.etherscan.io/address/${TOKEN}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {TOKEN}
                  <Icon name="external" size={14} />
                </a>
              </p>
              <p>
                Only confirmed SQK Approval events with the same owner and
                spender and a zero value count. Each unique address adds one
                stroke per UTC date. Any qualifying self-approval counts, even
                if it was sent outside this app.
              </p>
            </div>
          </details>
        </section>
      </main>
      <footer className="site-footer page-width">
        <a
          className="brand"
          href="https://squeekchain.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Hamster size={25} />
          <span>Powered by tiny paws.</span>
          <Icon name="external" size={14} />
        </a>
        <span className="muted">
          Wheel Canvas · A Squeekchain community artwork
        </span>
        <a href="#live" className="text-button">
          Back to canvas ↑
        </a>
      </footer>
      {walletOpen && <WalletSheet onClose={() => setWalletOpen(false)} />}
      {selectedNight && (
        <NightViewer
          key={selectedNight.date}
          night={selectedNight}
          address={address}
          onClose={closeNight}
          previous={
            nights.includes(selectedNight)
              ? nights[nights.indexOf(selectedNight) + 1]?.date
              : undefined
          }
          next={
            nights.includes(selectedNight)
              ? nights[nights.indexOf(selectedNight) - 1]?.date
              : undefined
          }
          onNavigate={navigate}
          signerError={signers.error}
          onRetry={signers.retry}
        />
      )}
    </>
  );
}
