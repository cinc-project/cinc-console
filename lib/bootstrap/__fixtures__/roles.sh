set -e
CINC_INSTALLER="$(mktemp)"
trap 'rm -f "$CINC_INSTALLER"' EXIT
curl -fsSL 'https://omnitruck.cinc.sh/install.sh' -o "$CINC_INSTALLER"
sudo bash "$CINC_INSTALLER"
sudo mkdir -p /etc/cinc
sudo install -m 0600 /dev/null /etc/cinc/client.pem
cat <<'CINC_EOF' | sudo tee '/etc/cinc/client.pem' >/dev/null
-----BEGIN RSA PRIVATE KEY-----
TESTKEYLINE1
TESTKEYLINE2
-----END RSA PRIVATE KEY-----
CINC_EOF
sudo chmod 0600 /etc/cinc/client.pem
cat <<'CINC_EOF' | sudo tee '/etc/cinc/client.rb' >/dev/null
chef_server_url 'https://cinc.example.test/organizations/acme'
node_name 'web01'
client_key '/etc/cinc/client.pem'

CINC_EOF
cat <<'CINC_EOF' | sudo tee '/etc/cinc/first-boot.json' >/dev/null
{
  "chef_environment": "production",
  "run_list": [
    "role[base]",
    "recipe[apt@1.2.3]"
  ]
}
CINC_EOF
sudo cinc-client -j /etc/cinc/first-boot.json