# Front-end statique — reproduit l'hébergement Hostinger (Apache + .htaccess).
# nginx ignorerait le .htaccess : on garde donc Apache pour tester à l'identique.
FROM httpd:2.4-alpine

# Active mod_rewrite (URLs propres) et mod_headers (CSP du .htaccess).
RUN sed -i \
      -e 's|^#\(LoadModule rewrite_module .*\)|\1|' \
      -e 's|^#\(LoadModule headers_module .*\)|\1|' \
      /usr/local/apache2/conf/httpd.conf \
    # Autorise les .htaccess dans la racine web (Hostinger : activé par défaut).
    && sed -i 's|AllowOverride None|AllowOverride All|g' \
      /usr/local/apache2/conf/httpd.conf

# Copie le site (index.html, *.dc.html, *.js, assets/, .htaccess).
COPY . /usr/local/apache2/htdocs/

EXPOSE 80
