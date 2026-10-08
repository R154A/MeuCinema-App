# 🎬 Meu Cinema

Seu Letterboxd + JustWatch pessoal para Windows: busque filmes e séries, marque o que já assistiu, monte listas, veja onde assistir, elenco, notas e estatísticas. Os dados ficam só no seu computador. Usa a API gratuita do [TMDB](https://www.themoviedb.org/).

## ⬇️ Passo 1 — Baixar e instalar

1. 👉 **[Clique aqui para abrir a última versão (Releases)](https://github.com/R154A/MeuCinema-App/releases/latest)**
2. Role até **Assets** e clique em **`MeuCinemaSetup.exe`** para baixar.
3. Dê dois cliques no arquivo, siga o assistente e abra o **Meu Cinema** pelo atalho criado.

> O Windows pode mostrar o aviso "O Windows protegeu seu computador" (o instalador não tem assinatura digital paga). Clique em **Mais informações → Executar assim mesmo**.

## 🔑 Passo 2 — Gerar a sua chave (API Key) do TMDB — grátis

O app precisa de uma chave do TMDB para buscar filmes e séries. Cada pessoa gera a sua; é de graça e leva uns 5 minutos.

1. 👉 **[Criar conta gratuita no TMDB](https://www.themoviedb.org/signup)** (se já tem conta, use **[Entrar](https://www.themoviedb.org/login)**). Confirme o e-mail que eles enviarem.
2. 👉 **[Abrir a página de API nas Configurações](https://www.themoviedb.org/settings/api)** (se pedir, faça login). Também dá para chegar clicando na sua foto/inicial (canto superior direito) → **Configurações** → **API** no menu da esquerda.
3. Clique em **Criar** / **Solicitar uma chave de API** (*Request an API key*) e escolha o tipo **Developer** (uso pessoal).
4. Aceite os termos de uso.
5. Preencha o formulário. Exemplo:
   - **Tipo de uso:** Desktop application / uso pessoal
   - **Nome do aplicativo:** Meu Cinema
   - **URL do aplicativo:** `http://localhost`
   - **Resumo:** App pessoal para organizar os filmes e séries que assisto.
   - Preencha também seus dados (nome, endereço, telefone) como pedido.
6. Ao enviar, volte para 👉 **[a página de API](https://www.themoviedb.org/settings/api)**. Lá aparecem duas chaves. **Copie qualquer uma das duas** (o app aceita as duas):
   - **Chave da API** (*API Key*): código curto; ou
   - **Token de Leitura da API** (*API Read Access Token*): código bem longo.

Precisa de ajuda? Veja a [documentação oficial do TMDB](https://developer.themoviedb.org/docs/getting-started) e a [central de suporte](https://www.themoviedb.org/talk).

## ⚙️ Passo 3 — Colocar a chave no app

1. Abra o **Meu Cinema**.
2. Clique em **Ajustes** no menu.
3. No cartão **🔑 Chave do TMDB**, cole a chave no campo **"Cole a chave aqui"**.
4. Clique em **Salvar**. Deve aparecer "Chave salva ✓".
5. Volte ao início: os filmes e séries já vão carregar. 🍿

Você só precisa fazer isso uma vez. **Nunca compartilhe a sua chave** com outras pessoas nem a publique na internet.

## 💾 Seus dados

Ficam em `%APPDATA%\MeuCinema` (biblioteca e configurações). Use **Ajustes → Exportar backup** de vez em quando.

## 🛠️ Para desenvolvedores

- Rodar sem instalar: `pip install pywebview` e depois `python app.py` (ou `python app.py --browser`).
- Gerar o instalador: aba **Actions → Gerar instalador → Run workflow**. O `MeuCinemaSetup.exe` é publicado automaticamente em **Releases**.

---
Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
