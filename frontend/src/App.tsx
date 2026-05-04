import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type NavItem = {
  label: string;
  path: string;
};

type FeatureCard = {
  title: string;
  body: string;
};

type Setting = {
  name: string;
  defaultValue: string;
  description: string;
};

const navItems: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/features' },
  { label: 'Docs', path: '/docs' },
  { label: 'Privacy', path: '/privacy-security' },
  { label: 'Developers', path: '/developers' },
  { label: 'Troubleshooting', path: '/troubleshooting' }
];

const mainFeatures: FeatureCard[] = [
  {
    title: 'Local Ollama autocomplete',
    body: 'Copilot-style ghost text runs through your configured Ollama host, with full or one-line inline completion modes.'
  },
  {
    title: 'Editor-aware chat',
    body: 'The chat panel can answer freeform questions about the active file or selected code and includes quick actions for common tasks.'
  },
  {
    title: 'Selected-code commands',
    body: 'Explain code, explain errors, add comments, fix code, generate tests, and solve coding problems directly from VS Code.'
  },
  {
    title: 'Safe apply flow',
    body: 'Fixes and comment generation open a diff preview first. You choose whether to apply, copy, or cancel the proposed replacement.'
  },
  {
    title: 'Low-resource modes',
    body: 'Micro, lite, standard, custom, and auto modes tune context and output budgets so local models stay responsive.'
  },
  {
    title: 'Private by design',
    body: 'LocalPilot has no telemetry, avoids sensitive files, and redacts secret-like strings before prompt text reaches Ollama.'
  }
];

const commandList = [
  'LocalPilot: Open Chat',
  'LocalPilot: Explain Selected Code',
  'LocalPilot: Explain Error',
  'LocalPilot: Add Comments to Selection',
  'LocalPilot: Fix Selected Code',
  'LocalPilot: Generate Tests',
  'LocalPilot: Solve Coding Problem',
  'LocalPilot: Check Ollama Status',
  'LocalPilot: Select Local Model',
  'LocalPilot: Switch Inline Completion Mode',
  'LocalPilot: Open Status Menu',
  'LocalPilot: Run Setup'
];

const settings: Setting[] = [
  {
    name: 'localpilot.ollamaHost',
    defaultValue: 'http://localhost:11434',
    description: 'Local Ollama REST API host.'
  },
  {
    name: 'localpilot.inlineModel',
    defaultValue: 'qwen2.5-coder:1.5b',
    description: 'Model used for inline code suggestions.'
  },
  {
    name: 'localpilot.chatModel',
    defaultValue: 'qwen2.5-coder:7b',
    description: 'Model used for chat and larger coding tasks.'
  },
  {
    name: 'localpilot.lowRamModel',
    defaultValue: 'qwen2.5-coder:0.5b',
    description: 'Smaller model preferred in low-resource mode.'
  },
  {
    name: 'localpilot.mode',
    defaultValue: 'auto',
    description: 'Resource profile: auto, micro, lite, standard, or custom.'
  },
  {
    name: 'localpilot.enableInlineSuggestions',
    defaultValue: 'true',
    description: 'Enables Copilot-style inline suggestions.'
  },
  {
    name: 'localpilot.inlineCompletionMode',
    defaultValue: 'full',
    description: 'Use full multiline autocomplete or conservative line suggestions.'
  },
  {
    name: 'localpilot.maxContextLines',
    defaultValue: '80',
    description: 'Maximum nearby source lines LocalPilot may include in prompts.'
  },
  {
    name: 'localpilot.maxOutputTokens',
    defaultValue: '160',
    description: 'Maximum tokens requested from Ollama.'
  },
  {
    name: 'localpilot.temperature',
    defaultValue: '0.2',
    description: 'Generation temperature for Ollama requests.'
  },
  {
    name: 'localpilot.inlineDebounceMs',
    defaultValue: '250',
    description: 'Delay before sending inline completion requests.'
  },
  {
    name: 'localpilot.disableInlineForLargeFiles',
    defaultValue: 'true',
    description: 'Skips inline suggestions for files at or above the size limit.'
  },
  {
    name: 'localpilot.maxFileSizeKb',
    defaultValue: '500',
    description: 'Maximum file size LocalPilot may inspect.'
  },
  {
    name: 'localpilot.enableLowRamWarnings',
    defaultValue: 'true',
    description: 'Shows warnings when work is skipped to stay responsive.'
  }
];

const recommendedModels = [
  {
    label: 'Balanced',
    model: 'qwen2.5-coder:1.5b',
    use: 'Responsive local autocomplete and chat.'
  },
  {
    label: 'Quality',
    model: 'qwen2.5-coder:7b',
    use: 'Stronger coding help on machines with more memory.'
  },
  {
    label: 'Micro',
    model: 'smollm2:360m',
    use: 'Very low-resource machines.'
  },
  {
    label: 'Lite',
    model: 'deepseek-coder:1.3b',
    use: 'Older low-end setups.'
  },
  {
    label: 'Compact',
    model: 'codegemma:2b',
    use: 'Small general coding model.'
  }
];

const architectureAreas = [
  {
    title: 'Activation and commands',
    body: 'src/extension.ts wires command registration, inline completions, code actions, onboarding, status bar, and chat.'
  },
  {
    title: 'Ollama integration',
    body: 'src/ollama contains health checks, local model listing, chat, completion, and model pull calls against the configured host.'
  },
  {
    title: 'Context and safety',
    body: 'src/context builds bounded prompt context, blocks sensitive paths, skips large files, and redacts secret-like strings.'
  },
  {
    title: 'Editor UI',
    body: 'src/webview powers chat, src/status powers the status menu, and src/apply handles diff preview plus explicit apply confirmation.'
  },
  {
    title: 'Performance controls',
    body: 'src/performance implements mode resolution, request limiting, completion caching, and token budgets.'
  },
  {
    title: 'Prompts and tests',
    body: 'src/prompts holds task prompts, while test coverage checks providers, commands, context, onboarding, Ollama, webviews, and apply behavior.'
  }
];

function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/privacy-security" element={<PrivacySecurityPage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/troubleshooting" element={<TroubleshootingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="brand" to="/" onClick={() => setOpen(false)}>
        <img src="/localpilot-icon.png" alt="" className="brand-icon" />
        <span>
          <strong>LocalPilot</strong>
          <small>VS Code local AI assistant</small>
        </span>
      </Link>
      <button
        className="nav-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="site-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <nav id="site-navigation" className={open ? 'site-nav open' : 'site-nav'}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setOpen(false)}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Local-first coding help for VS Code</p>
          <h1>LocalPilot</h1>
          <p className="hero-copy">
            A private Ollama-powered coding assistant for developers who want autocomplete, chat,
            explanations, fixes, tests, and safe code edits without sending source code to cloud AI
            services.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/docs">
              Read setup docs
            </Link>
            <Link className="button secondary" to="/features">
              Explore capabilities
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-label="LocalPilot editor workflow preview">
          <div className="editor-window">
            <div className="window-bar">
              <span />
              <span />
              <span />
              <strong>localpilot.ts</strong>
            </div>
            <pre>
              <code>{`function completeLocally(context) {
  const host = "http://localhost:11434";
  const model = "qwen2.5-coder:1.5b";

  return ollama.generate({
    host,
    model,
    prompt: context.safePrompt
  });
}`}</code>
            </pre>
            <div className="ghost-text">LocalPilot suggestion: keep the request local.</div>
          </div>
        </div>
      </section>

      <section className="content-section first-section">
        <div className="section-heading">
          <p className="eyebrow">What it does</p>
          <h2>Practical AI assistance with local boundaries</h2>
          <p>
            LocalPilot is built around a simple contract: VS Code prepares bounded, filtered context
            and sends it only to the configured Ollama REST API host.
          </p>
        </div>
        <div className="feature-grid">
          {mainFeatures.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section split-section">
        <div>
          <p className="eyebrow">Quick setup</p>
          <h2>Bring your own Ollama model</h2>
          <p>
            Install Ollama, start the local server, pull a coding model, then run LocalPilot setup
            inside VS Code. The extension asks before any model download.
          </p>
        </div>
        <CodeBlock
          code={`ollama serve
ollama pull qwen2.5-coder:1.5b
code --install-extension localpilot-0.0.1.vsix`}
        />
      </section>
    </>
  );
}

function FeaturesPage() {
  return (
    <PageFrame
      eyebrow="Capabilities"
      title="Everything LocalPilot can do"
      intro="The extension combines inline completions, command-driven code assistance, chat, setup workflows, safety filters, and resource controls."
    >
      <section className="content-section compact-top">
        <div className="feature-grid">
          {[
            {
              title: 'Inline ghost text',
              body: 'LocalPilot registers an inline completion provider for JavaScript, TypeScript, React, Python, Java, C, C++, C#, Go, Rust, and PHP. It supports full multiline suggestions and conservative line mode.'
            },
            {
              title: 'Chat panel',
              body: 'The chat webview can answer questions about the active editor, selected code, or the current file. Quick actions include explain file, explain selection, find bugs, fix selection, add comments, and generate tests.'
            },
            {
              title: 'Code actions',
              body: 'Lightbulb actions appear for supported source files and expose explain, comment, fix, and test generation flows.'
            },
            {
              title: 'Explain error',
              body: 'Select a stack trace or paste an error message. LocalPilot redacts secrets, includes safe code context when available, and opens the explanation in Markdown.'
            },
            {
              title: 'Safe edits',
              body: 'Fix and comment commands strip code fences, open a diff preview, and require explicit apply confirmation. Copy and cancel remain available.'
            },
            {
              title: 'Status menu',
              body: 'The status bar shows Ollama readiness, inline mode, configured models, and shortcuts for setup, chat, model selection, status checks, and inline toggling.'
            },
            {
              title: 'First-run setup',
              body: 'Onboarding checks Ollama, lists local models, lets users select inline and chat models, and offers recommended model pulls only after confirmation.'
            },
            {
              title: 'Performance safeguards',
              body: 'Request limiting cancels stale inline requests, completion caching avoids repeated calls, and token budgets shrink in micro and lite modes.'
            }
          ].map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Supported languages</p>
          <h2>Inline and code actions focus on common programming stacks</h2>
        </div>
        <div className="tag-list">
          {[
            'JavaScript',
            'TypeScript',
            'React JSX',
            'Python',
            'Java',
            'C',
            'C++',
            'C#',
            'Go',
            'Rust',
            'PHP'
          ].map((language) => (
            <span key={language}>{language}</span>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}

function DocsPage() {
  return (
    <PageFrame
      eyebrow="Documentation"
      title="Install, configure, and run LocalPilot"
      intro="LocalPilot is packaged as a VS Code extension and depends on a reachable Ollama host for local model inference."
    >
      <section className="content-section compact-top docs-stack">
        <DocBlock title="Install the VSIX">
          <p>Install the packaged extension with VS Code:</p>
          <CodeBlock code="code --install-extension localpilot-0.0.1.vsix" />
        </DocBlock>

        <DocBlock title="Local development">
          <p>Use Node.js 20 or newer. Compile the extension, then press F5 in VS Code.</p>
          <CodeBlock
            code={`npm install
npm run compile`}
          />
        </DocBlock>

        <DocBlock title="Ollama setup">
          <p>
            Install Ollama from ollama.com/download, start the local server, and keep the default
            host unless you intentionally use a different endpoint.
          </p>
          <CodeBlock
            code={`ollama serve

# Default LocalPilot host
http://localhost:11434`}
          />
        </DocBlock>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Models</p>
          <h2>Recommended local model profiles</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Model</th>
                <th>Best for</th>
              </tr>
            </thead>
            <tbody>
              {recommendedModels.map((model) => (
                <tr key={model.model}>
                  <td>{model.label}</td>
                  <td>
                    <code>{model.model}</code>
                  </td>
                  <td>{model.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-section split-section">
        <div>
          <p className="eyebrow">Commands</p>
          <h2>VS Code command palette entries</h2>
          <p>
            LocalPilot exposes editor commands, setup commands, model selection, health checks, and
            chat access.
          </p>
        </div>
        <ul className="check-list two-column">
          {commandList.map((command) => (
            <li key={command}>{command}</li>
          ))}
        </ul>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Settings</p>
          <h2>Configuration reference</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.name}>
                  <td>
                    <code>{setting.name}</code>
                  </td>
                  <td>
                    <code>{setting.defaultValue}</code>
                  </td>
                  <td>{setting.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}

function PrivacySecurityPage() {
  return (
    <PageFrame
      eyebrow="Privacy and security"
      title="Local-first defaults with explicit edit control"
      intro="LocalPilot is designed to avoid cloud AI APIs and telemetry while still giving useful editor assistance."
    >
      <section className="content-section compact-top">
        <div className="feature-grid">
          {[
            {
              title: 'No cloud AI APIs',
              body: 'Code context is prepared inside VS Code and sent only to the configured Ollama REST API host. The default is http://localhost:11434.'
            },
            {
              title: 'No telemetry',
              body: 'LocalPilot does not collect usage, prompts, completions, files, errors, or workspace metadata.'
            },
            {
              title: 'Host is user-controlled',
              body: 'If localpilot.ollamaHost is changed, requests go to that configured host. Users are responsible for their Ollama server and installed models.'
            },
            {
              title: 'Clipboard is intentional',
              body: 'LocalPilot writes to the clipboard only when the user chooses a copy action.'
            }
          ].map((item) => (
            <article className="feature-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section split-section">
        <div>
          <p className="eyebrow">Safety filters</p>
          <h2>Files LocalPilot avoids reading</h2>
          <p>
            The context builder blocks sensitive or noisy paths before prompt construction and skips
            oversized files based on configuration.
          </p>
        </div>
        <ul className="check-list">
          <li>.env files and .env variants</li>
          <li>Private key names such as id_rsa and id_ed25519</li>
          <li>.pem and .key files</li>
          <li>Lock files such as package-lock.json, yarn.lock, and pnpm-lock.yaml</li>
          <li>Generated and dependency folders such as node_modules, dist, build, and coverage</li>
          <li>Minified or bundled files</li>
          <li>Files larger than localpilot.maxFileSizeKb</li>
        </ul>
      </section>

      <section className="content-section split-section">
        <div>
          <p className="eyebrow">Secret redaction</p>
          <h2>Prompt text is scrubbed before Ollama calls</h2>
          <p>
            Secret-like strings are replaced with a redaction marker before they are sent to the
            configured model.
          </p>
        </div>
        <ul className="check-list">
          <li>Private key blocks</li>
          <li>AWS-style access keys</li>
          <li>API key, secret, token, and password assignments</li>
          <li>JWT-like values</li>
          <li>Very long token-like strings</li>
        </ul>
      </section>
    </PageFrame>
  );
}

function DevelopersPage() {
  return (
    <PageFrame
      eyebrow="Developers"
      title="How the extension is organized"
      intro="LocalPilot uses small TypeScript modules around VS Code APIs, Ollama calls, context building, webviews, and editor-safe apply flows."
    >
      <section className="content-section compact-top">
        <div className="feature-grid">
          {architectureAreas.map((area) => (
            <article className="feature-card" key={area.title}>
              <h3>{area.title}</h3>
              <p>{area.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section split-section">
        <div>
          <p className="eyebrow">Development commands</p>
          <h2>Build, lint, test, and package</h2>
          <p>
            The extension expects Node.js 20 or newer and VS Code 1.90 or newer. Run checks before
            opening a pull request.
          </p>
        </div>
        <CodeBlock
          code={`npm run compile
npm run lint
npm test
npm run package`}
        />
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Contribution principles</p>
          <h2>Keep LocalPilot local, focused, and safe</h2>
        </div>
        <ul className="check-list two-column">
          <li>Keep the assistant local-first.</li>
          <li>Do not add cloud AI APIs.</li>
          <li>Do not add telemetry.</li>
          <li>Prefer VS Code APIs and simple TypeScript modules.</li>
          <li>Respect filters for secrets, generated files, dependency folders, and large files.</li>
          <li>Every Ollama-backed feature should fail gracefully when Ollama is unavailable.</li>
        </ul>
      </section>
    </PageFrame>
  );
}

function TroubleshootingPage() {
  return (
    <PageFrame
      eyebrow="Troubleshooting"
      title="Fix common LocalPilot setup and runtime issues"
      intro="Most issues come down to Ollama reachability, missing local models, model size, or safety filters doing their job."
    >
      <section className="content-section compact-top docs-stack">
        {[
          {
            title: 'Ollama is disconnected',
            body: 'Start Ollama, keep the host reachable, then run LocalPilot: Check Ollama Status.',
            code: 'ollama serve'
          },
          {
            title: 'No models are found',
            body: 'Run LocalPilot: Run Setup or pull a model manually, then select it inside VS Code.',
            code: 'ollama pull qwen2.5-coder:1.5b'
          },
          {
            title: 'Inline suggestions feel slow',
            body: 'Switch inline completion mode to line, use micro or lite mode, lower context/output limits, or choose a smaller model.',
            code: 'localpilot.inlineCompletionMode = line\nlocalpilot.mode = lite'
          },
          {
            title: 'Output quality is weak',
            body: 'Try a larger coding model and select it for chat or inline suggestions with LocalPilot: Select Local Model.',
            code: 'ollama pull qwen2.5-coder:7b'
          },
          {
            title: 'Files are skipped',
            body: 'LocalPilot intentionally blocks secrets, generated folders, dependency folders, lock files, minified files, and oversized files.',
            code: 'localpilot.maxFileSizeKb = 500'
          }
        ].map((item) => (
          <DocBlock title={item.title} key={item.title}>
            <p>{item.body}</p>
            <CodeBlock code={item.code} />
          </DocBlock>
        ))}
      </section>
    </PageFrame>
  );
}

function PageFrame(props: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className="page-hero">
        <p className="eyebrow">{props.eyebrow}</p>
        <h1>{props.title}</h1>
        <p>{props.intro}</p>
      </section>
      {props.children}
    </>
  );
}

function DocBlock(props: { title: string; children: ReactNode }) {
  return (
    <article className="doc-block">
      <h2>{props.title}</h2>
      {props.children}
    </article>
  );
}

function CodeBlock(props: { code: string }) {
  return (
    <pre className="code-block">
      <code>{props.code}</code>
    </pre>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  return null;
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>LocalPilot</strong>
        <p>Local Ollama-powered AI coding assistance for VS Code.</p>
      </div>
      <div className="footer-links">
        <Link to="/privacy-security">Privacy</Link>
        <Link to="/developers">Developers</Link>
        <Link to="/troubleshooting">Troubleshooting</Link>
      </div>
    </footer>
  );
}

export default App;
