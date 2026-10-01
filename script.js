/* ============================================================
   TMDB MOVIE EXPLORER
   Projeto: API Hunters
   O que esse arquivo faz:
   1. Guarda a chave da API e o que está sendo exibido (estado)
   2. Monta a URL certa pra cada ação (buscar ou listar populares)
   3. Chama a API da TMDB usando fetch + async/await
   4. Mostra na tela: carregando, erro, "sem resultados" ou os filmes
   ============================================================ */

// ---------- 1. Configurações fixas da API ----------
const TMDB = {
  baseUrl: "https://api.themoviedb.org/3",
  imagemUrl: "https://image.tmdb.org/t/p/w342",
};

// ---------- 2. Estado da aplicação ----------
// Tudo que pode mudar enquanto o usuário usa o site fica guardado aqui.
let estado = {
  chaveApi: localStorage.getItem("tmdb_api_key") || "",
  modoAtual: "populares",   // pode ser "populares" ou "busca"
  termoBusca: "",
  paginaAtual: 1,
  totalDePaginas: 1,
  carrinho: carregarCarrinhoDoNavegador(), // lista de filmes adicionados
};

// ---------- 3. Atalhos para os elementos do HTML ----------
const tela = {
  caixaConfig: document.getElementById("configBox"),
  caixaChaveOk: document.getElementById("apiKeyOk"),
  campoChave: document.getElementById("apiKeyInput"),
  botaoSalvarChave: document.getElementById("saveKeyBtn"),
  botaoTrocarChave: document.getElementById("changeKeyBtn"),
  campoBusca: document.getElementById("searchInput"),
  botaoBuscar: document.getElementById("searchBtn"),
  botaoPopulares: document.getElementById("popularBtn"),
  conteudo: document.getElementById("content"),
  caixaPaginacao: document.getElementById("paginationBox"),
  textoPagina: document.getElementById("pageInfo"),
  botaoAnterior: document.getElementById("prevBtn"),
  botaoProxima: document.getElementById("nextBtn"),
  botaoCarrinho: document.getElementById("cartToggleBtn"),
  contadorCarrinho: document.getElementById("cartCount"),
  overlayCarrinho: document.getElementById("cartOverlay"),
  painelCarrinho: document.getElementById("cartPanel"),
  botaoFecharCarrinho: document.getElementById("cartCloseBtn"),
  listaCarrinho: document.getElementById("cartItems"),
  totalCarrinho: document.getElementById("cartTotal"),
};

/* ============================================================
   CONTROLE DA CHAVE DE API
   (sem chave, a gente nem tenta chamar a API)
   ============================================================ */

function mostrarTelaCorreta() {
  const temChave = Boolean(estado.chaveApi);
  tela.caixaConfig.classList.toggle("hidden", temChave);
  tela.caixaChaveOk.classList.toggle("hidden", !temChave);
}

tela.botaoSalvarChave.addEventListener("click", () => {
  const chaveDigitada = tela.campoChave.value.trim();
  if (!chaveDigitada) return;

  estado.chaveApi = chaveDigitada;
  salvarChaveNoNavegador(chaveDigitada);
  mostrarTelaCorreta();
  carregarFilmes();
});

tela.botaoTrocarChave.addEventListener("click", () => {
  estado.chaveApi = "";
  salvarChaveNoNavegador("");
  tela.campoChave.value = "";
  mostrarTelaCorreta();
});

// localStorage pode falhar (modo anônimo, navegador bloqueando etc),
// por isso sempre colocamos num try/catch pra não travar o site.
function salvarChaveNoNavegador(chave) {
  try {
    if (chave) {
      localStorage.setItem("tmdb_api_key", chave);
    } else {
      localStorage.removeItem("tmdb_api_key");
    }
  } catch (erro) {
    console.warn("Não deu pra salvar a chave no navegador:", erro);
  }
}

/* ============================================================
   INTERATIVIDADE: busca, populares e paginação
   ============================================================ */

tela.botaoBuscar.addEventListener("click", iniciarBusca);

tela.campoBusca.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") iniciarBusca();
});

function iniciarBusca() {
  const termo = tela.campoBusca.value.trim();
  if (!termo) return;

  estado.modoAtual = "busca";
  estado.termoBusca = termo;
  estado.paginaAtual = 1;
  carregarFilmes();
}

tela.botaoPopulares.addEventListener("click", () => {
  estado.modoAtual = "populares";
  estado.termoBusca = "";
  estado.paginaAtual = 1;
  tela.campoBusca.value = "";
  carregarFilmes();
});

tela.botaoAnterior.addEventListener("click", () => {
  if (estado.paginaAtual <= 1) return;
  estado.paginaAtual -= 1;
  carregarFilmes();
});

tela.botaoProxima.addEventListener("click", () => {
  if (estado.paginaAtual >= estado.totalDePaginas) return;
  estado.paginaAtual += 1;
  carregarFilmes();
});

/* ============================================================
   CONSUMO DA API
   Aqui é o coração do projeto: montar a URL certa e buscar os dados.
   ============================================================ */

// Monta a URL certa dependendo se o usuário está buscando um filme
// ou só olhando a lista de populares.
function montarUrlDaBusca() {
  const chave = encodeURIComponent(estado.chaveApi);
  const pagina = estado.paginaAtual;

  if (estado.modoAtual === "busca") {
    const termo = encodeURIComponent(estado.termoBusca);
    return `${TMDB.baseUrl}/search/movie?api_key=${chave}&language=pt-BR&query=${termo}&page=${pagina}`;
  }

  return `${TMDB.baseUrl}/movie/popular?api_key=${chave}&language=pt-BR&page=${pagina}`;
}

// Função principal: chama a API, trata erro e manda renderizar o resultado.
async function carregarFilmes() {
  if (!estado.chaveApi) {
    mostrarTelaCorreta();
    return;
  }

  mostrarCarregando();

  try {
    const resposta = await fetch(montarUrlDaBusca());

    // Se a API respondeu mas com um erro (ex: chave errada, limite excedido)
    if (!resposta.ok) {
      if (resposta.status === 401) {
        throw new Error("Essa chave de API não é válida. Confira se copiou certinho.");
      }
      throw new Error(`A API da TMDB respondeu com erro (código ${resposta.status}).`);
    }

    const dados = await resposta.json();

    if (!dados.results || dados.results.length === 0) {
      mostrarSemResultados();
      return;
    }

    estado.totalDePaginas = Math.min(dados.total_pages || 1, 500);
    mostrarFilmes(dados.results);
    atualizarPaginacao();

  } catch (erro) {
    // Cai aqui tanto em erro de rede (sem internet) quanto nos
    // erros que a gente mesmo lançou lá em cima.
    mostrarErro(erro.message || "Não foi possível buscar os filmes agora. Tente de novo em instantes.");
  }
}

/* ============================================================
   RENDERIZAÇÃO NA TELA
   ============================================================ */

function mostrarCarregando() {
  tela.conteudo.innerHTML = `
    <div class="status">
      <div class="spinner"></div>
      Loading...
    </div>`;
  tela.caixaPaginacao.style.display = "none";
}

function mostrarErro(mensagem) {
  tela.conteudo.innerHTML = `
    <div class="error-box">
      <strong>Ops! Algo deu errado.</strong>
      ${mensagem}
    </div>`;
  tela.caixaPaginacao.style.display = "none";
}

function mostrarSemResultados() {
  tela.conteudo.innerHTML = `<div class="status">Nenhum filme encontrado com esse nome 🔍</div>`;
  tela.caixaPaginacao.style.display = "none";
}

function mostrarFilmes(filmes) {
  const cards = filmes.map(criarCardDoFilme).join("");
  tela.conteudo.innerHTML = `<div class="grid">${cards}</div>`;

  // Escuta o clique nos botões "+ Carrinho" de todos os cards recém-criados.
  tela.conteudo.querySelectorAll(".add-cart-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      const idDoFilme = Number(botao.dataset.id);
      const filme = filmes.find((f) => f.id === idDoFilme);
      if (filme) adicionarAoCarrinho(filme);
    });
  });
}

function criarCardDoFilme(filme) {
  const temPoster = Boolean(filme.poster_path);
  const poster = temPoster
    ? `<img src="${TMDB.imagemUrl}${filme.poster_path}" alt="Pôster de ${escaparTexto(filme.title)}" loading="lazy">`
    : `<div class="no-img">Sem imagem disponível</div>`;

  const ano = filme.release_date ? filme.release_date.slice(0, 4) : "—";
  const nota = filme.vote_average ? filme.vote_average.toFixed(1) : "N/A";
  const jaEstaNoCarrinho = estado.carrinho.some((item) => item.id === filme.id);
  const preco = gerarPrecoDoFilme(filme.id);

  return `
    <div class="card" title="${escaparTexto(filme.overview || "")}">
      <div class="poster-wrap">${poster}</div>
      <div class="card-body">
        <h3>${escaparTexto(filme.title)}</h3>
        <div class="meta">
          <span>${ano}</span>
          <span class="rating">⭐ ${nota}</span>
        </div>
        <div class="price">${formatarPreco(preco)}</div>
        <button class="add-cart-btn ${jaEstaNoCarrinho ? "added" : ""}" data-id="${filme.id}">
          ${jaEstaNoCarrinho ? "✓ No carrinho" : "+ Carrinho"}
        </button>
      </div>
    </div>`;
}

// A TMDB não fornece preço de filme (ela só tem dados de catálogo).
// Por isso geramos um valor fictício, mas fixo por filme: o mesmo
// filme sempre terá o mesmo preço, baseado no próprio ID dele.
function gerarPrecoDoFilme(idDoFilme) {
  const precoMinimo = 14.9;
  const precoMaximo = 49.9;
  const fatorPseudoAleatorio = (idDoFilme % 100) / 100; // sempre entre 0 e 1
  const preco = precoMinimo + fatorPseudoAleatorio * (precoMaximo - precoMinimo);
  return Math.round(preco * 100) / 100;
}

function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ============================================================
   CARRINHO
   Guarda os filmes escolhidos, com persistência no navegador.
   ============================================================ */

function carregarCarrinhoDoNavegador() {
  try {
    const salvo = localStorage.getItem("tmdb_carrinho");
    return salvo ? JSON.parse(salvo) : [];
  } catch (erro) {
    console.warn("Não deu pra carregar o carrinho salvo:", erro);
    return [];
  }
}

function salvarCarrinhoNoNavegador() {
  try {
    localStorage.setItem("tmdb_carrinho", JSON.stringify(estado.carrinho));
  } catch (erro) {
    console.warn("Não deu pra salvar o carrinho:", erro);
  }
}

function adicionarAoCarrinho(filme) {
  const jaEsta = estado.carrinho.some((item) => item.id === filme.id);
  if (jaEsta) return;

  estado.carrinho.push({
    id: filme.id,
    title: filme.title,
    poster_path: filme.poster_path,
    release_date: filme.release_date,
    preco: gerarPrecoDoFilme(filme.id),
  });

  salvarCarrinhoNoNavegador();
  atualizarContadorCarrinho();
  renderizarCarrinho();

  // Atualiza o botão do card pra refletir "já adicionado", sem recarregar tudo.
  const botao = tela.conteudo.querySelector(`.add-cart-btn[data-id="${filme.id}"]`);
  if (botao) {
    botao.classList.add("added");
    botao.textContent = "✓ No carrinho";
  }
}

function removerDoCarrinho(idDoFilme) {
  estado.carrinho = estado.carrinho.filter((item) => item.id !== idDoFilme);
  salvarCarrinhoNoNavegador();
  atualizarContadorCarrinho();
  renderizarCarrinho();

  // Se o card desse filme ainda estiver visível na lista/busca,
  // volta o botão dele pro estado "+ Carrinho".
  const botao = tela.conteudo.querySelector(`.add-cart-btn[data-id="${idDoFilme}"]`);
  if (botao) {
    botao.classList.remove("added");
    botao.textContent = "+ Carrinho";
  }
}

function atualizarContadorCarrinho() {
  tela.contadorCarrinho.textContent = estado.carrinho.length;
}

function renderizarCarrinho() {
  if (estado.carrinho.length === 0) {
    tela.listaCarrinho.innerHTML = `<p class="cart-empty">Seu carrinho está vazio. Adicione filmes da lista ou busque na API!</p>`;
    tela.totalCarrinho.textContent = "";
    return;
  }

  tela.listaCarrinho.innerHTML = estado.carrinho.map((filme) => {
    const poster = filme.poster_path
      ? `<img src="${TMDB.imagemUrl}${filme.poster_path}" alt="${escaparTexto(filme.title)}">`
      : `<img src="" alt="" style="visibility:hidden;">`;
    const ano = filme.release_date ? filme.release_date.slice(0, 4) : "—";

    return `
      <div class="cart-item">
        ${poster}
        <div class="cart-item-info">
          <h4>${escaparTexto(filme.title)}</h4>
          <span>${ano} · ${formatarPreco(filme.preco)}</span>
        </div>
        <button class="remove-btn" data-id="${filme.id}">Remover</button>
      </div>`;
  }).join("");

  // Liga o botão "Remover" de cada item recém-renderizado.
  tela.listaCarrinho.querySelectorAll(".remove-btn").forEach((botao) => {
    botao.addEventListener("click", () => removerDoCarrinho(Number(botao.dataset.id)));
  });

  const total = estado.carrinho.reduce((soma, filme) => soma + filme.preco, 0);
  tela.totalCarrinho.textContent = `Total: ${formatarPreco(total)}`;
}

function abrirCarrinho() {
  tela.overlayCarrinho.classList.remove("hidden");
  tela.painelCarrinho.classList.remove("hidden");
  renderizarCarrinho();
}

function fecharCarrinho() {
  tela.overlayCarrinho.classList.add("hidden");
  tela.painelCarrinho.classList.add("hidden");
}

tela.botaoCarrinho.addEventListener("click", abrirCarrinho);
tela.botaoFecharCarrinho.addEventListener("click", fecharCarrinho);
tela.overlayCarrinho.addEventListener("click", fecharCarrinho);

function atualizarPaginacao() {
  tela.caixaPaginacao.style.display = "flex";
  tela.textoPagina.textContent = `Página ${estado.paginaAtual} de ${estado.totalDePaginas}`;
  tela.botaoAnterior.disabled = estado.paginaAtual <= 1;
  tela.botaoProxima.disabled = estado.paginaAtual >= estado.totalDePaginas;
}

// Evita que título/sinopse do filme quebrem o HTML (proteção simples contra XSS).
function escaparTexto(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   INICIALIZAÇÃO
   Roda assim que a página carrega.
   ============================================================ */
mostrarTelaCorreta();
atualizarContadorCarrinho();
if (estado.chaveApi) {
  carregarFilmes();
}