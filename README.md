# 🎬 Meu Cinema

Seu Letterboxd + JustWatch pessoal para Windows: busque filmes e séries, marque o que já assistiu, monte listas, veja onde assistir, elenco, notas e estatísticas. Os dados ficam só no seu computador. Usa a API gratuita do [TMDB](https://www.themoviedb.org/).

## ⬇️ Como baixar e instalar

1. Abra a aba **[Releases](../../releases/latest)** deste repositório (lado direito da página, em "Releases").
2. Em **Assets**, baixe o arquivo **`MeuCinemaSetup.exe`**.
3. Dê dois cliques, siga o assistente e abra o **Meu Cinema** pelo atalho criado.

> O Windows pode mostrar o aviso "O Windows protegeu seu computador" (o instalador não tem assinatura digital paga). Clique em **Mais informações → Executar assim mesmo**.

## 🔑 Como gerar a sua chave (API Key) do TMDB — grátis

O app precisa de uma chave do TMDB para buscar filmes e séries. Cada pessoa gera a sua, é de graça e leva uns 5 minutos:

1. Acesse **https://www.themoviedb.org/signup** e crie uma conta gratuita. Confirme o e-mail que eles enviarem.
2. Faça login e clique na sua foto/inicial no canto superior direito → **Configurações** (Settings).
3. No menu da esquerda, clique em **API**.
4. Clique em **Criar** / **Solicitar uma chave de API** (Request an API key) e escolha o tipo **Developer** (uso pessoal).
5. Aceite os termos de uso.
6. Preencha o formulário. Exemplo:
   - **Tipo de uso:** Desktop application / Uso pessoal
   - **Nome do aplicativo:** Meu Cinema
   - **URL do aplicativo:** `http://localhost`
   - **Resumo:** App pessoal para organizar os filmes e séries que assisto.
   - Preencha também seus dados (nome, endereço, telefone) como pedido.
7. Ao enviar, a página **API** mostra duas chaves. **Copie qualquer uma das duas** (o app aceita as duas):
   - **Chave da API** (API Key) — código curto; ou
   - **Token de Leitura da API** (API Read Access Token) — código bem longo.

## ⚙️ Como colocar a chave no app

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
