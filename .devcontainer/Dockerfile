FROM ghcr.io/lesomnus/dev-node:20

RUN TEMP=$(mktemp -d) \
	ARCH=$(dpkg --print-architecture) \
	&& cd "${TEMP}" \
	&& curl -o ./a.tar.gz -sSL "https://get.helm.sh/helm-v3.15.3-linux-${ARCH}.tar.gz" \
	&& tar -zxf ./a.tar.gz \
	&& mv "linux-${ARCH}/helm" /usr/local/bin/. \
	&& rm -rf "${TEMP}"



USER hypnos

# Comment below lines if you don't want to use Zsh
RUN wget https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh -O - | zsh || true \
	&& git clone https://github.com/zsh-users/zsh-autosuggestions         ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions     \
	&& git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting \
	&& git clone https://github.com/zsh-users/zsh-completions             ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-completions         \
	&& git clone https://github.com/supercrabtree/k                       ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/k
COPY .zshrc /home/hypnos
ENV SHELL /bin/zsh
