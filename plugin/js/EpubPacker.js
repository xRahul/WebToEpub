/*
  Functions for packing an EPUB file
*/
"use strict";

/*
    For our purposes, an EPUB only contains two types of content file: XHTML and image.
    - The HTML files are in reading order (i.e. Appear in same order as spine and table of contents (ToC))
    - If a HTML file entry has a "title" element, it will appear in the ToC
    - Stand alone images (e.g. Cover) will have a XHTML entry that points to the image.
    - First image, (if there are any) is be the cover image
*/

/// <param name="uuid" type="string">identifier for this EPUB.  (i.e. "origin" URL story was downloaded from)</param>
/// <param name="title" type="string">The Title of the story</param>
/// <param name="author" type="string">The writer of the story</param>
function EpubPacker(metaInfo) {
    let that = this;
    that.metaInfo = metaInfo;
}

EpubPacker.prototype = {

    assembleAndSave: function (fileName, epubItemSupplier) {
        let that = this;
        that.save(that.assemble(epubItemSupplier), fileName);
    },

    assemble: function (epubItemSupplier) {
        let that = this;
        let zipFile = new JSZip();
        that.addRequiredFiles(zipFile);
        zipFile.file("content.opf", that.buildContentOpf(epubItemSupplier), { compression: "DEFLATE" });
        zipFile.file("toc.ncx", that.buildTableOfContents(epubItemSupplier), { compression: "DEFLATE" });
        that.packXhtmlFiles(zipFile, epubItemSupplier);
        return zipFile.generate({ type: "blob" });
    },

    // write blob to "Downloads" directory
    save: function (blob, fileName) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
    },

    // every EPUB must have a mimetype and a container.xml file
    addRequiredFiles: function(zipFile) {
        zipFile.file("mimetype", "application/epub+zip");
        zipFile.file("META-INF/container.xml",
            "<?xml version=\"1.0\"?>" +
            "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">" +
                "<rootfiles>" +
                    "<rootfile full-path=\"content.opf\" media-type=\"application/oebps-package+xml\"/>" +
                "</rootfiles>" +
            "</container>"
        );
    },

    buildContentOpf: function (epubItemSupplier) {
        let that = this;
        let ns = "http://www.idpf.org/2007/opf";
        let opf = document.implementation.createDocument(ns, "package", null);
        opf.documentElement.setAttribute("version", "2.0");
        opf.documentElement.setAttribute("unique-identifier", "BookId");
        that.buildMetaData(opf);
        that.buildManifest(opf, epubItemSupplier);
        that.buildSpine(opf, epubItemSupplier);
        that.buildGuide(opf);

        return util.xmlToString(opf);
    },

    buildMetaData: function (opf) {
        let that = this;
        var metadata = that.createAndAppendChild(opf.documentElement, "metadata");
        metadata.setAttribute("xmlns:dc", "http://purl.org/dc/elements/1.1/");
        metadata.setAttribute("xmlns:opf", "http://www.idpf.org/2007/opf");

        that.createAndAppendChild(metadata, "dc:title", that.metaInfo.title);
        that.createAndAppendChild(metadata, "dc:language", that.metaInfo.language);
        that.createAndAppendChild(metadata, "dc:date", that.getDateForMetaData());

        let author = that.createAndAppendChild(metadata, "dc:creator", that.metaInfo.author);
        author.setAttribute("opf:file-as", that.metaInfo.author);
        author.setAttribute("opf:role", "aut");

        let identifier = that.createAndAppendChild(metadata, "dc:identifier", that.metaInfo.uuid);
        identifier.setAttribute("id", "BookId");
        identifier.setAttribute("opf:scheme", "URI");
    },

    buildManifest: function (opf, epubItemSupplier) {
        let that = this;
        var manifest = that.createAndAppendChild(opf.documentElement, "manifest");
        for(let item of epubItemSupplier.manifestItems()) {
            that.addManifestItem(manifest, item.href, item.id, item.mediaType);
        };

        // ToDo: image files (with exception of cover) go here.

        that.addManifestItem(manifest, "toc.ncx", "ncx", "application/x-dtbncx+xml");
    },

    addManifestItem: function(manifest, href, id, mediaType) {
        let that = this;
        var item = that.createAndAppendChild(manifest, "item");
        item.setAttribute("href", href);
        item.setAttribute("id", id);
        item.setAttribute("media-type", mediaType);
    },

    buildSpine: function (opf, epubItemSupplier) {
        let that = this;
        let spine = that.createAndAppendChild(opf.documentElement, "spine");
        spine.setAttribute("toc", "ncx");
        for(let item of epubItemSupplier.spineItems()) {
            that.createAndAppendChild(spine, "itemref").setAttribute("idref", item.id);
        };
    },

    buildGuide: function (opf) {
        let that = this;
        // ToDo, typically, link to cover goes here.
    },

    buildTableOfContents: function (epubItemSupplier) {
        let that = this;
        let ns = "http://www.daisy.org/z3986/2005/ncx/";
        let ncx = document.implementation.createDocument(ns, "ncx", null);
        ncx.documentElement.setAttribute("version", "2005-1");
        ncx.documentElement.setAttribute("xml:lang", that.metaInfo.language);
        that.buildHead(ncx);
        that.buildDocTitle(ncx);
        that.buildNavMap(ncx, epubItemSupplier);

        return util.xmlToString(ncx);
    },

    buildHead: function (ncx) {
        let that = this;
        let head = that.createAndAppendChild(ncx.documentElement, "head");
        that.buildHeadMeta(head, that.metaInfo.uuid, "dtb:uid");
        that.buildHeadMeta(head, "2", "dtb:depth");
        that.buildHeadMeta(head, "0", "dtb:totalPageCount");
        that.buildHeadMeta(head, "0", "dtb:maxPageNumber");
    },

    buildHeadMeta: function (head, content, name) {
        let that = this;
        let meta = that.createAndAppendChild(head, "meta");
        meta.setAttribute("content", content);
        meta.setAttribute("name", name);
    },

    buildDocTitle: function (ncx) {
        let that = this;
        let docTitle = that.createAndAppendChild(ncx.documentElement, "docTitle");
        that.createAndAppendChild(docTitle, "text", that.metaInfo.title);
    },

    buildNavMap: function (ncx, epubItemSupplier) {
        let that = this;
        let navMap = that.createAndAppendChild(ncx.documentElement, "navMap");
        let playOrder = 0;
        for(let chapterTitle of epubItemSupplier.chapterInfo()) {
            that.buildNavPoint(navMap, ++playOrder, chapterTitle.title, chapterTitle.src);
        };
    },

    buildNavPoint: function (navMap, playOrder, title, src) {
        let that = this;
        let navPoint = that.createAndAppendChild(navMap, "navPoint");
        navPoint.setAttribute("id", util.zeroPad(playOrder));
        navPoint.setAttribute("playOrder", playOrder);
        let navLabel = that.createAndAppendChild(navPoint, "navLabel");
        that.createAndAppendChild(navLabel, "text", title);
        that.createAndAppendChild(navPoint, "content").setAttribute("src", src);
    },

    packXhtmlFiles: function (zipFile, epubItemSupplier) {
        let that = this;
        for(let file of epubItemSupplier.files()) {
            zipFile.file(file.href, file.content, { compression: "DEFLATE" });
        };
    },

    createAndAppendChild: function (element, name, data) {
        let child = element.ownerDocument.createElement(name);
        if (typeof data  !== "undefined") {
            child.appendChild(element.ownerDocument.createTextNode(data));
        }
        element.appendChild(child);
        return child;
    },

    /// hook point for unit testing (because we can't control the actual time)
    /// return time string to put into <date> element of metadata
    getDateForMetaData: function () {
        return new Date().toISOString();
    }
}
