"use strict";

parserFactory.register("pawread.com", () => new PawreadParser());

class PawreadParser extends Parser{
    constructor() {
        super();
    }

    async getChapterUrls(dom) {
        let items = [...dom.querySelectorAll("div.filtr-item .item-box")];
        return items.map(this.itemToChapter);
    }

    itemToChapter(item) {
        let path = item.getAttribute("onclick").split("'")[1];
        return ({
            sourceUrl:  "https://www.pawread.com" + path,
            title: item.querySelector(".c_title").textContent,
        });
    }

    findContent(dom) {
        return dom.querySelector("#chapter_item");
    }

    extractTitleImpl(dom) {
        return dom.querySelector("h1");
    }

    findChapterTitle(dom) {
        return dom.querySelector("h3");
    }

    findCoverImageUrl(dom) {
        let div = dom.querySelector(".comic-view [style*=background-image]");
        return util.extractUrlFromBackgroundImage(div);
    }

    getInformationEpubItemChildNodes(dom) {
        return [...dom.querySelectorAll("p.txtDesc")];
    }
}
