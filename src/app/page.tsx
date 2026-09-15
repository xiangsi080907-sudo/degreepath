import Link from "next/link";
import {
  ArrowUpRight,
  GitBranch,
  SlidersHorizontal,
  BookOpen,
  Check,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Brand, Disclaimer } from "@/components/brand";
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" aria-label="DegreePath home">
          <Brand />
        </Link>
        <nav>
          <Link href="/demo/sources">Our data</Link>
          <Link href="/login">Sign in</Link>
          <Link className="button dark" href="/register">
            Build my plan <ArrowUpRight size={17} />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              UW SEATTLE · A LITTLE CLARITY. A LOT OF POSSIBILITY.
            </span>
            <h1>
              Plan the path
              <br />
              to <span>graduation.</span>
            </h1>
            <p>
              Your courses connect. See how. Check prerequisites, explore your
              requirements, and build a quarter-by-quarter plan you can
              understand.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/register">
                Build my plan <ArrowRight size={18} />
              </Link>
              <Link className="button outline" href="/demo">
                Explore demo <ArrowUpRight size={18} />
              </Link>
            </div>
            <p className="hero-note">
              Starting with UW Seattle Computer Science.
              <br />
              Official source data. Clear review flags. No AI required.
            </p>
          </div>
          <div className="hero-planner">
            <div className="preview-top">
              <span className="eyebrow">THE BIG PICTURE</span>
              <span className="pill">Illustrative student plan</span>
            </div>
            <h2>One quarter. More possibilities.</h2>
            <div className="path-preview">
              <div className="preview-node done">
                <Check size={18} />
                <div>
                  <strong>CSE 123</strong>
                  <small>Programming III · completed</small>
                </div>
              </div>
              <div className="path-line" />
              <div className="preview-node active">
                <GitBranch size={20} />
                <div>
                  <strong>CSE 311</strong>
                  <small>Foundations of Computing I</small>
                </div>
                <span className="pill">Next step</span>
              </div>
              <div className="path-line" />
              <div className="preview-branches">
                <div className="preview-node">
                  <div>
                    <strong>CSE 312</strong>
                    <small>Foundations II</small>
                  </div>
                </div>
                <div className="preview-node">
                  <div>
                    <strong>CSE 332</strong>
                    <small>Data structures</small>
                  </div>
                </div>
              </div>
            </div>
            <p className="preview-foot">
              CSE 311 also requires qualifying mathematics and grades. See every
              condition in the course explorer.
            </p>
          </div>
        </section>
        <section className="proof-strip">
          <span>BUILT FOR YOUR NEXT DECISION</span>
          <p>
            <Check size={17} /> Prerequisite-aware
          </p>
          <p>
            <Check size={17} /> Explainable plans
          </p>
          <p>
            <Check size={17} /> Official sources
          </p>
        </section>
        <section className="features">
          <div>
            <span className="eyebrow">LESS GUESSWORK, MORE DIRECTION</span>
            <h2>
              Know what’s next.
              <br />
              Understand why.
            </h2>
          </div>
          <div className="feature-grid">
            {[
              [
                GitBranch,
                "See the connections",
                "Trace prerequisites and find courses that open up more options.",
              ],
              [
                BookOpen,
                "Keep requirements in view",
                "Track completed coursework, remaining groups, and rules needing review.",
              ],
              [
                SlidersHorizontal,
                "Make room for change",
                "Compare credit loads and see what happens when a course moves.",
              ],
              [
                ShieldCheck,
                "Know where the data comes from",
                "Inspect official links, retrieval dates, and availability uncertainty.",
              ],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof GitBranch;
              return (
                <article key={String(title)}>
                  <I size={23} />
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <footer>
          <Brand />
          <Disclaimer />
          <Link href="/demo/sources">
            Sources & limitations <ArrowUpRight size={16} />
          </Link>
        </footer>
      </main>
    </div>
  );
}
