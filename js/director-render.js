/* =========================================================
   DARUL AMAN ACADEMY — DIRECTOR RENDER
   =========================================================
   Reads window.DAA_DIRECTOR (js/director-data.js) and paints it
   into whichever of the two templates is present on the page:
     1) #daaDirectorZoneCard   — full profile card (director_zone.html)
     2) #daaDirectorHomeCard   — home page "Director Message" section
   Editing js/director-data.js updates both automatically.
   ========================================================= */
(function () {
    const D = window.DAA_DIRECTOR;
    if (!D) return;

    function paragraphsHtml(paras) {
        return paras.map(function (p) { return '<p class="bn">' + p + '</p>'; }).join('');
    }

    // ---------- 1) Director Zone page — full card ----------
    const zoneMount = document.getElementById('daaDirectorZoneCard');
    if (zoneMount) {
        zoneMount.innerHTML =
            '<div class="img-wrap">' +
                '<img src="' + D.photo + '" alt="' + D.role + '">' +
                '<span class="badge-role eng">' + D.role + '</span>' +
            '</div>' +
            '<h3 class="eng">' + D.name + ' <span class="eng">' + D.nameSuffix + '</span></h3>' +
            '<h6 class="eng">' + D.roleLine + '</h6>' +
            paragraphsHtml(D.messageParagraphsBn) +
            '<div class="socials">' +
                '<a href="' + D.socials.facebook + '" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a>' +
                '<a href="' + D.socials.instagram + '" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
                '<a href="' + D.socials.linkedin + '" aria-label="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>' +
            '</div>';
    }

    // ---------- 2) Home page — Director Message section ----------
    const homeMount = document.getElementById('daaDirectorHomeCard');
    if (homeMount) {
        homeMount.innerHTML =
            '<div class="dm-photo-wrap">' +
                '<img class="dm-seal" src="' + D.seal + '" alt="Darul Aman Academy Seal">' +
                '<img class="dm-photo" src="' + D.photo + '" alt="' + D.role + '">' +
                '<div class="dm-quote-ribbon">' +
                    '<i class="fa-solid fa-quote-left"></i>' +
                    '<p class="dm-quote-text bn">' + D.quoteBn + '</p>' +
                    '<span class="dm-quote-source bn">' + D.quoteSourceBn + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="dm-content">' +
                '<p class="dm-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>' +
                '<div class="dm-divider"></div>' +
                '<h3 class="dm-greeting bn">' + D.greetingBn + '</h3>' +
                '<div class="dm-message">' + paragraphsHtml(D.messageParagraphsBn) + '</div>' +
                '<div class="dm-signature-row">' +
                    '<img class="dm-signature" src="' + D.signature + '" alt="Signature of ' + D.name + '">' +
                    '<div class="dm-signature-meta">' +
                        '<strong class="eng">' + D.name + ' <span class="eng">' + D.nameSuffix + '</span></strong>' +
                        '<span class="dm-role eng">' + D.role + '</span>' +
                        '<span class="dm-subtitle eng">Darul Aman Academy Cox\'s Bazar</span>' +
                    '</div>' +
                    '<a href="director_zone.html" class="dm-readmore eng">Full Message <i class="fa fa-arrow-right"></i></a>' +
                '</div>' +
            '</div>';
    }

    // ---------- 3) Home page — Our Commitment strip ----------
    const commitMount = document.getElementById('daaCommitmentGrid');
    if (commitMount && Array.isArray(D.commitments)) {
        commitMount.innerHTML = D.commitments.map(function (c) {
            return '' +
                '<div class="dm-commit-item">' +
                    '<div class="dm-commit-icon"><i class="fa-solid ' + c.icon + '"></i></div>' +
                    '<h4 class="bn">' + c.titleBn + '</h4>' +
                    '<span class="dm-commit-eng eng">' + c.titleEng + '</span>' +
                    '<p class="bn">' + c.descBn + '</p>' +
                '</div>';
        }).join('');
    }
})();
