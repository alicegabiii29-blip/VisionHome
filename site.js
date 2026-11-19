function criarSidebarInterna() {
  if (document.querySelector('.dashboard-sidebar')) return;

  document.body.classList.add('has-sidebar');
  document.body.insertAdjacentHTML('afterbegin', `
    <aside class="dashboard-sidebar" id="dashboardSidebar">
      <div class="sidebar-brand">
        <a href="index.html" aria-label="VisionHome - visão geral"><img src="IMAGENS2/logo.png" alt=""><span>Vision<span>Home</span></span></a>
        <button class="sidebar-close" type="button" onclick="alternarSidebar()" aria-label="Fechar menu">×</button>
      </div>
      <nav class="sidebar-nav" aria-label="Navegação principal">
        <span class="sidebar-label">PAINEL</span>
        <a class="sidebar-link" href="index.html"><i>⌂</i><span>Visão geral</span></a>
        <a class="sidebar-link" href="imoveis.html"><i>⌕</i><span>Explorar imóveis</span></a>
        <a class="sidebar-link" href="personalizacao.html"><i>✦</i><span>Personalizar espaço</span></a>
        <a class="sidebar-link" href="vivi.html"><i>◌</i><span>Falar com a Vivi</span></a>
        <span class="sidebar-label sidebar-label-second">MINHA ÁREA</span>
        <a class="sidebar-link" href="anunciar.html"><i>⌂</i><span>Anunciar imóvel</span></a>
      </nav>
      <div class="sidebar-bottom"><span class="sidebar-status"><i></i> VisionHome online</span><a class="sidebar-profile" href="index.html?auth=login"><span class="sidebar-avatar">VH</span><span><b>Minha conta</b><small>Entrar ou cadastrar</small></span><strong>→</strong></a></div>
    </aside>
    <div class="sidebar-backdrop" onclick="alternarSidebar()"></div>
  `);

  const pagina = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.dashboard-sidebar .sidebar-link').forEach(link => {
    if (link.getAttribute('href') === pagina) link.classList.add('ativo');
  });
}

criarSidebarInterna();

const lenis = new Lenis({
  duration: 1.15,
  smoothWheel: true,
  smoothTouch: false,
  anchors: false
});

function animarScroll(tempo) {
  lenis.raf(tempo);
  requestAnimationFrame(animarScroll);
}

requestAnimationFrame(animarScroll);

const header = document.querySelector('.header');

lenis.on('scroll', ({ scroll }) => {
  if (header) header.classList.toggle('header-scrolled', scroll > 28);
});

function alternarMenu() {
  if (document.body.classList.contains('has-sidebar')) {
    alternarSidebar();
    return;
  }

  const menu = document.getElementById('menuTela');
  const botao = document.getElementById('menuBotao');

  if (!menu || !botao) return;

  menu.classList.toggle('aberto');
  botao.classList.toggle('ativo');
  botao.setAttribute('aria-expanded', menu.classList.contains('aberto'));
  document.body.classList.toggle('menu-aberto', menu.classList.contains('aberto'));
}

function fecharMenu() {
  if (document.body.classList.contains('has-sidebar')) {
    fecharSidebar();
    return;
  }

  const menu = document.getElementById('menuTela');
  const botao = document.getElementById('menuBotao');

  if (!menu || !botao) return;

  menu.classList.remove('aberto');
  botao.classList.remove('ativo');
  botao.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-aberto');
}

function alternarSidebar() {
  const sidebar = document.getElementById('dashboardSidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('sidebar-open');
  document.body.classList.toggle('sidebar-visible', sidebar.classList.contains('sidebar-open'));
}

function fecharSidebar() {
  const sidebar = document.getElementById('dashboardSidebar');
  if (!sidebar) return;
  sidebar.classList.remove('sidebar-open');
  document.body.classList.remove('sidebar-visible');
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const destino = document.querySelector(link.getAttribute('href'));
    if (!destino) return;

    event.preventDefault();
    lenis.scrollTo(destino, { offset: -82 });
  });
});

const observer = new IntersectionObserver((entries, instance) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    entry.target.classList.add('is-visible');
    instance.unobserve(entry.target);
  });
}, { threshold: .12, rootMargin: '0px 0px -40px' });

document.querySelectorAll('[data-reveal]').forEach((element, index) => {
  element.style.setProperty('--reveal-delay', `${Math.min(index * 70, 280)}ms`);
  element.classList.add('reveal-ready');
  observer.observe(element);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') fecharMenu();
});
